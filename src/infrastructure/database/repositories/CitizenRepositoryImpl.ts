import { database } from '../index';
import Citizen from '../Citizen';
import { UnifiedCitizenProfile } from '../../../domain/models/Citizen';
import { ICitizenRepository } from '../../../domain/repositories/ICitizenRepository';
import { GraphTopology } from '../../../domain/models/GraphTopology';
import { Province } from '../../../domain/models/Province';
import { TrustLink } from '../../../domain/models/TrustLink';
import { Cause } from '../../../domain/models/Cause';
import { GENESIS_ARCHITECT_NPUB } from '../../../domain/models/Title';

export class CitizenRepositoryImpl implements ICitizenRepository {
  /**
   * Helper unificado para obtener el ciudadano principal de la sesión activa de forma segura.
   * Si no existe en SQLite, se crea de forma atómica.
   */
  private async getMainCitizen(currentNpub?: string): Promise<Citizen | null> {
    const citizensCollection = database.collections.get('citizens');
    const allCitizens = await citizensCollection.query().fetch();

    if (currentNpub) {
      const found = allCitizens.find((c: any) => c.npub === currentNpub) as Citizen;
      if (found) return found;

      let createdCit: Citizen | null = null;
      await database.write(async () => {
        createdCit = (await citizensCollection.create((c: any) => {
          c.npub = currentNpub;
          c.alias = 'Yo';
          c.role = 'CITIZEN';
          c.merit = 0;
        })) as Citizen;
      });
      return createdCit;
    }

    return (allCitizens[0] as Citizen) || null;
  }

  /**
   * Obtiene la red de ciudadanos hidratada, fusionando los datos públicos de la red 
   * con los datos locales (privados) del dispositivo para mantener la separación SOLID.
   *
   * Algoritmo:
   * 1. Construir un mapa de adyacencia bidireccional a partir de trust_links.
   * 2. BFS desde el nodo principal, asignando niveles 0→3.
   * 3. Emitir cada link exactamente una vez: los links del BFS spanning tree
   *    y los cross-links entre nodos ya descubiertos.
   */
  async getHydratedCitizens(currentNpub?: string): Promise<GraphTopology> {
    const allCitizens = await database.collections.get('citizens').query().fetch();
    const allLinks = await database.collections.get('trust_links').query().fetch();
    const allProvinces = await database.collections.get('provinces').query().fetch();
    const allMemberships = await database.collections.get('citizen_provinces').query().fetch();

    const provincesList: Province[] = [];
    const simLinks: TrustLink[] = [];

    const mainCit = await this.getMainCitizen(currentNpub);
    if (!mainCit) return { citizens: [], provinces: [], links: [] };

    // Map de ciudadanos por ID para O(1) lookups
    const citizenMap = new Map(allCitizens.map(c => [c.id, c as Citizen]));

    // ── 1. Construir Mapa de Adyacencia Bidireccional ──
    // Cada entrada: citizenId → [{neighborId, linkId}]
    type AdjEntry = { neighborId: string; linkId: string };
    const adjacency = new Map<string, AdjEntry[]>();

    allLinks.forEach((link: any) => {
      const sourceId: string = link._raw.from_citizen_id;
      const targetId: string = link._raw.to_citizen_id;
      const linkId: string = link.id;

      // Solo incluir links donde ambos extremos existen como ciudadanos
      if (!citizenMap.has(sourceId) || !citizenMap.has(targetId)) return;

      if (!adjacency.has(sourceId)) adjacency.set(sourceId, []);
      if (!adjacency.has(targetId)) adjacency.set(targetId, []);

      adjacency.get(sourceId)!.push({ neighborId: targetId, linkId });
      adjacency.get(targetId)!.push({ neighborId: sourceId, linkId });
    });

    // ── 2. BFS desde el nodo principal ──
    const citizenMapDomain = new Map<string, UnifiedCitizenProfile>();
    const levelMap = new Map<string, number>(); // id → level asignado por BFS
    const processedLinkIds = new Set<string>();

    const addNode = (cit: Citizen, level: number) => {
      if (citizenMapDomain.has(cit.id)) return;
      levelMap.set(cit.id, level);
      citizenMapDomain.set(cit.id, {
        networkData: {
          id: cit.id,
          npub: cit.npub,
          alias: level === 0 ? 'Yo' : (cit.alias || 'Unknown'),
          merit: cit.merit || 0,
          role: cit.role || 'CITIZEN',
        },
        localData: {
          localName: cit.localName,
        },
        level,
        nodeType: 'CITIZEN'
      });
    };

    // Semilla: nodo principal en nivel 0
    addNode(mainCit, 0);
    const queue: { id: string; level: number }[] = [{ id: mainCit.id, level: 0 }];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.level >= 3) continue;

      const nextLevel = current.level + 1;
      const neighbors = adjacency.get(current.id) || [];

      for (const { neighborId, linkId } of neighbors) {
        // Emitir el link si aún no fue procesado
        if (!processedLinkIds.has(linkId)) {
          processedLinkIds.add(linkId);

          const neighborLevel = levelMap.has(neighborId)
            ? Math.max(levelMap.get(neighborId)!, nextLevel)
            : nextLevel;

          simLinks.push({
            sourceId: current.id,
            targetId: neighborId,
            level: neighborLevel,
            type: 'TRUST',
          });
        }

        // Descubrir nodos nuevos
        if (!citizenMapDomain.has(neighborId)) {
          const neighborCit = citizenMap.get(neighborId);
          if (neighborCit) {
            addNode(neighborCit, nextLevel);
            queue.push({ id: neighborId, level: nextLevel });
          }
        }
      }
    }

    // ── 3. Cross-links entre nodos descubiertos que no fueron parte del BFS ──
    allLinks.forEach((link: any) => {
      const linkId: string = link.id;
      if (processedLinkIds.has(linkId)) return;

      const sourceId: string = link._raw.from_citizen_id;
      const targetId: string = link._raw.to_citizen_id;

      if (citizenMapDomain.has(sourceId) && citizenMapDomain.has(targetId)) {
        processedLinkIds.add(linkId);
        const l1 = citizenMapDomain.get(sourceId)!.level;
        const l2 = citizenMapDomain.get(targetId)!.level;
        simLinks.push({
          sourceId,
          targetId,
          level: Math.max(l1, l2),
          type: 'TRUST',
        });
      }
    });

    // ── 4. Provincias ──
    allProvinces.forEach((p: any) => {
      provincesList.push({
        id: p.id,
        name: p.name || 'Provincia Desconocida',
        founderId: 'unknown',
        createdAt: new Date(),
        level: -1,
      });
    });

    // Links de membresía (Ciudadano → Provincia)
    allMemberships.forEach(m => {
      const citizenId = (m as any)._raw.citizen_id;
      const provinceId = (m as any)._raw.province_id;

      if (citizenMapDomain.has(citizenId)) {
        simLinks.push({ sourceId: provinceId, targetId: citizenId, level: -1, type: 'MEMBERSHIP' });
      }
    });

    // ── 5. Causas (LOD 3) ──
    const causesList: Cause[] = [
      { id: 'cause_1', title: 'Soberanía Energética', description: 'Red de micro-generación solar compartida', supportersCount: 142, status: 'ACTIVA', level: -2 },
      { id: 'cause_2', title: 'Red Monetaria P2P', description: 'Infraestructura libre sin intermediarios bancarios', supportersCount: 389, status: 'EN Votación', level: -2 },
      { id: 'cause_3', title: 'Gobernanza Libre', description: 'Decisiones distribuidas con firmas multifirma', supportersCount: 210, status: 'ACTIVA', level: -2 },
    ];

    // Conectar Provincias con Causas
    provincesList.forEach((prov, i) => {
      const targetCause = causesList[i % causesList.length];
      simLinks.push({
        sourceId: prov.id,
        targetId: targetCause.id,
        level: -2,
        type: 'PROVINCE_TO_CAUSE'
      });
    });

    return {
      citizens: Array.from(citizenMapDomain.values()),
      provinces: provincesList,
      causes: causesList,
      links: simLinks,
    };
  }

  /**
   * Crea una nueva provincia en la base de datos local y
   * vincula al ciudadano principal como fundador/miembro.
   */
  async createProvince(name: string, description: string, currentNpub?: string): Promise<void> {
    const mainCit = await this.getMainCitizen(currentNpub);
    if (!mainCit) throw new Error("Ciudadano principal no encontrado.");

    await database.write(async () => {
      const provincesCollection = database.collections.get('provinces');
      const membershipsCollection = database.collections.get('citizen_provinces');

      // 1. Crear Provincia
      const newProv = await provincesCollection.create((p: any) => {
        p.pubkey = `prov_${Date.now()}`;
        p.name = name;
        p.description = description;
        p.founderPubkey = mainCit.id;
        p.status = 'ACTIVE';
        p.isPublic = true;
      });

      // 2. Crear membresía (Fundador)
      await membershipsCollection.create((m: any) => {
        m.citizen.set(mainCit);
        m.province.set(newProv);
        m.role = 'FOUNDER';
      });
    });
  }

  /**
   * Acredita a un nuevo ciudadano en la Red de Confianza local (Nivel 1).
   */
  async addCitizenToLevel1(npub: string, alias?: string, currentNpub?: string): Promise<void> {
    const mainCit = await this.getMainCitizen(currentNpub);
    if (!mainCit) throw new Error("Ciudadano principal no encontrado.");

    const citizenAlias = alias || `Amarata-${npub.substring(5, 9).toUpperCase()}`;

    await database.write(async () => {
      const citizensCollection = database.collections.get('citizens');
      const linksCollection = database.collections.get('trust_links');

      const existingCitizens = await citizensCollection.query().fetch();
      let targetCitizen = existingCitizens.find((c: any) => c.npub === npub) as Citizen;

      if (!targetCitizen) {
        targetCitizen = (await citizensCollection.create((c: any) => {
          c.npub = npub;
          c.alias = citizenAlias;
          c.role = 'CITIZEN';
          c.merit = 0;
        })) as Citizen;
      }

      const existingLinks = await linksCollection.query().fetch();
      const linkExists = existingLinks.some(
        (l: any) =>
          (l._raw.from_citizen_id === mainCit.id && l._raw.to_citizen_id === targetCitizen.id) ||
          (l._raw.from_citizen_id === targetCitizen.id && l._raw.to_citizen_id === mainCit.id)
      );

      if (!linkExists) {
        await linksCollection.create((l: any) => {
          l.fromCitizen.set(mainCit);
          l.toCitizen.set(targetCitizen);
          l.level = 1;
        });
      }

      // Si el rol local del usuario principal era TOURIST, asciende automáticamente a CITIZEN al crear su red
      if (mainCit.role === 'TOURIST') {
        await mainCit.update((record: any) => {
          record.role = 'CITIZEN';
        });
      }
    });
  }

  /**
   * Revoca la Visa otorgada a un ciudadano, destruyendo el enlace directo de Nivel 1 en ambos sentidos.
   * Retorna la npub del ciudadano revocado para emitir la notificación P2P.
   */
  async revokeVisa(targetCitizenIdOrNpub: string, currentNpub?: string): Promise<string | null> {
    const mainCit = await this.getMainCitizen(currentNpub);
    if (!mainCit) throw new Error("Ciudadano principal no encontrado.");

    const allCitizens = await database.collections.get('citizens').query().fetch();
    const targetCitizen = allCitizens.find(
      (c: any) => c.id === targetCitizenIdOrNpub || c.npub === targetCitizenIdOrNpub
    ) as Citizen;

    if (!targetCitizen) return null;

    await database.write(async () => {
      const linksCollection = database.collections.get('trust_links');
      const allLinks = await linksCollection.query().fetch();

      const linksToDelete = allLinks.filter(
        (l: any) =>
          (l._raw.from_citizen_id === mainCit.id && l._raw.to_citizen_id === targetCitizen.id) ||
          (l._raw.from_citizen_id === targetCitizen.id && l._raw.to_citizen_id === mainCit.id)
      );

      for (const link of linksToDelete) {
        await link.destroyPermanently();
      }

      // Recalcular enlaces restantes de mainCit
      const remainingLinks = allLinks.filter(
        (l: any) =>
          !linksToDelete.includes(l) &&
          (l._raw.from_citizen_id === mainCit.id || l._raw.to_citizen_id === mainCit.id)
      );

      const isGenesis = Boolean(GENESIS_ARCHITECT_NPUB && mainCit.npub === GENESIS_ARCHITECT_NPUB);
      if (remainingLinks.length === 0 && !isGenesis && mainCit.role === 'CITIZEN') {
        await mainCit.update((c: any) => {
          c.role = 'TOURIST';
        });
      }
    });

    return targetCitizen.npub;
  }

  /**
   * Obtiene las estadísticas de conteo de nodos por nivel de confianza (1º, 2º y 3er grado).
   */
  async getNetworkStats(currentNpub?: string): Promise<{ level1: number; level2: number; level3: number }> {
    const topology = await this.getHydratedCitizens(currentNpub);
    let level1 = 0;
    let level2 = 0;
    let level3 = 0;

    topology.citizens.forEach(c => {
      if (c.level === 1) level1++;
      else if (c.level === 2) level2++;
      else if (c.level === 3) level3++;
    });

    return { level1, level2, level3 };
  }

  /**
   * Obtiene los nombres de las provincias a las que pertenece el usuario actual.
   */
  async getMyProvinces(currentNpub?: string): Promise<string[]> {
    const mainCit = await this.getMainCitizen(currentNpub);
    if (!mainCit) return [];

    const allMemberships = await database.collections.get('citizen_provinces').query().fetch();
    const myMemberships = allMemberships.filter((m: any) => m._raw.citizen_id === mainCit.id);
    const provinceIds = new Set(myMemberships.map((m: any) => m._raw.province_id));

    const allProvinces = await database.collections.get('provinces').query().fetch();
    const myProvinces = allProvinces.filter((p: any) => provinceIds.has(p.id));

    return myProvinces.map((p: any) => p.name || 'Provincia');
  }

  /**
   * Obtiene el perfil cívico completo del usuario con sus títulos evaluados dinámicamente.
   */
  async getMyCivicProfile(currentNpub?: string): Promise<any> {
    const mainCit = await this.getMainCitizen(currentNpub);

    if (!mainCit) {
      return {
        alias: 'Turista',
        npub: currentNpub || '',
        role: 'TOURIST',
        isGenesis: false,
        titles: [{
          id: 'tourist',
          name: 'Turista',
          icon: '🧭',
          description: 'Visitante de la red sin derechos de voto ni emisión de visas.',
          category: 'TOURIST',
        }],
        networkStats: { level1: 0, level2: 0, level3: 0 },
        provinces: [],
      };
    }

    const { TitleEvaluatorService } = await import('../../../domain/services/TitleEvaluatorService');
    const { GENESIS_ARCHITECT_NPUB } = await import('../../../domain/models/Title');
    const evaluator = new TitleEvaluatorService();

    const networkStats = await this.getNetworkStats(mainCit.npub);
    const provinces = await this.getMyProvinces(mainCit.npub);

    const isGenesis = Boolean(GENESIS_ARCHITECT_NPUB && mainCit.npub === GENESIS_ARCHITECT_NPUB);
    const activeVisasCount = networkStats.level1;

    const context = {
      npub: mainCit.npub,
      isGenesis,
      activeVisasCount,
      provinces,
      merit: mainCit.merit,
    };

    const titles = evaluator.evaluateTitles(context);
    const role = evaluator.deriveRole(context);

    return {
      alias: mainCit.alias || `Amarata-${mainCit.npub.substring(5, 9).toUpperCase()}`,
      npub: mainCit.npub,
      role,
      isGenesis,
      titles,
      networkStats,
      provinces,
    };
  }

  /**
   * Procesa la recepción de una Visa de un Padrino, creando el enlace de confianza y activando la ciudadanía.
   */
  async receiveVisaFrom(sponsorNpub: string, sponsorAlias?: string, currentNpub?: string): Promise<boolean> {
    const mainCit = await this.getMainCitizen(currentNpub);
    if (!mainCit) return false;

    // No procesar si el emisor es uno mismo
    if (mainCit.npub === sponsorNpub) return false;

    let isNewVisa = false;

    await database.write(async () => {
      const citizensCollection = database.collections.get('citizens');
      const linksCollection = database.collections.get('trust_links');

      const existingCitizens = await citizensCollection.query().fetch();
      let sponsorCit = existingCitizens.find((c: any) => c.npub === sponsorNpub) as Citizen;

      if (!sponsorCit) {
        sponsorCit = (await citizensCollection.create((c: any) => {
          c.npub = sponsorNpub;
          c.alias = sponsorAlias || `Amarata-${sponsorNpub.substring(5, 9).toUpperCase()}`;
          c.role = 'CITIZEN';
          c.merit = 0;
        })) as Citizen;
      }

      const existingLinks = await linksCollection.query().fetch();
      const linkExists = existingLinks.some(
        (l: any) =>
          (l._raw.from_citizen_id === mainCit.id && l._raw.to_citizen_id === sponsorCit.id) ||
          (l._raw.from_citizen_id === sponsorCit.id && l._raw.to_citizen_id === mainCit.id)
      );

      if (!linkExists) {
        await linksCollection.create((l: any) => {
          l.fromCitizen.set(mainCit);
          l.toCitizen.set(sponsorCit);
          l.level = 1;
        });
        isNewVisa = true;
      }

      // Si el rol era TOURIST, actualizar a CITIZEN
      if (mainCit.role === 'TOURIST') {
        await mainCit.update((record: any) => {
          record.role = 'CITIZEN';
        });
      }
    });

    return isNewVisa;
  }

  /**
   * Procesa la revocación de una Visa entrante, eliminando el enlace mutuo y recalculando el estado cívico.
   */
  async processVisaRevocation(sponsorNpub: string, currentNpub?: string): Promise<{ success: boolean; newRole: string; remainingVisas: number }> {
    const mainCit = await this.getMainCitizen(currentNpub);
    if (!mainCit) return { success: false, newRole: 'TOURIST', remainingVisas: 0 };

    const allCitizens = await database.collections.get('citizens').query().fetch();
    const sponsorCit = allCitizens.find((c: any) => c.npub === sponsorNpub) as Citizen;
    if (!sponsorCit) return { success: false, newRole: mainCit.role, remainingVisas: 0 };

    let remainingCount = 0;

    await database.write(async () => {
      const linksCollection = database.collections.get('trust_links');
      const allLinks = await linksCollection.query().fetch();

      const linksToDelete = allLinks.filter(
        (l: any) =>
          (l._raw.from_citizen_id === mainCit.id && l._raw.to_citizen_id === sponsorCit.id) ||
          (l._raw.from_citizen_id === sponsorCit.id && l._raw.to_citizen_id === mainCit.id)
      );

      for (const link of linksToDelete) {
        await link.destroyPermanently();
      }

      const remainingLinks = allLinks.filter(
        (l: any) =>
          !linksToDelete.includes(l) &&
          (l._raw.from_citizen_id === mainCit.id || l._raw.to_citizen_id === mainCit.id)
      );

      remainingCount = remainingLinks.length;
      const isGenesis = Boolean(GENESIS_ARCHITECT_NPUB && mainCit.npub === GENESIS_ARCHITECT_NPUB);

      if (remainingCount === 0 && !isGenesis && mainCit.role === 'CITIZEN') {
        await mainCit.update((c: any) => {
          c.role = 'TOURIST';
        });
      }
    });

    const isGenesis = Boolean(GENESIS_ARCHITECT_NPUB && mainCit.npub === GENESIS_ARCHITECT_NPUB);
    return {
      success: true,
      newRole: remainingCount > 0 || isGenesis ? 'CITIZEN' : 'TOURIST',
      remainingVisas: remainingCount,
    };
  }

  /**
   * Procesa un evento de Visa emitido en la red para descubrir y conectar nodos de 2º y 3er grado.
   */
  async processNetworkVisa(
    sponsorNpub: string,
    sponsorAlias: string,
    targetNpub: string,
    currentNpub?: string
  ): Promise<boolean> {
    const mainCit = await this.getMainCitizen(currentNpub);
    if (!mainCit) return false;

    if (targetNpub === mainCit.npub) {
      return this.receiveVisaFrom(sponsorNpub, sponsorAlias, currentNpub);
    }
    if (sponsorNpub === mainCit.npub) {
      await this.addCitizenToLevel1(targetNpub, undefined, currentNpub);
      return true;
    }

    const allCitizens = await database.collections.get('citizens').query().fetch();
    let sponsorCit = allCitizens.find((c: any) => c.npub === sponsorNpub) as Citizen;
    let targetCit = allCitizens.find((c: any) => c.npub === targetNpub) as Citizen;

    // Si ninguno de los dos existe en la base de datos local, no podemos vincularlo todavía
    if (!sponsorCit && !targetCit) {
      return false;
    }

    let isNew = false;
    await database.write(async () => {
      const citizensCollection = database.collections.get('citizens');
      const linksCollection = database.collections.get('trust_links');

      if (!sponsorCit) {
        sponsorCit = (await citizensCollection.create((c: any) => {
          c.npub = sponsorNpub;
          c.alias = sponsorAlias || `Amarata-${sponsorNpub.substring(5, 9).toUpperCase()}`;
          c.role = 'CITIZEN';
          c.merit = 0;
        })) as Citizen;
        isNew = true;
      }

      if (!targetCit) {
        targetCit = (await citizensCollection.create((c: any) => {
          c.npub = targetNpub;
          c.alias = `Amarata-${targetNpub.substring(5, 9).toUpperCase()}`;
          c.role = 'CITIZEN';
          c.merit = 0;
        })) as Citizen;
        isNew = true;
      }

      const allLinks = await linksCollection.query().fetch();
      const linkExists = allLinks.some(
        (l: any) =>
          (l._raw.from_citizen_id === sponsorCit.id && l._raw.to_citizen_id === targetCit.id) ||
          (l._raw.from_citizen_id === targetCit.id && l._raw.to_citizen_id === sponsorCit.id)
      );

      if (!linkExists) {
        await linksCollection.create((l: any) => {
          l.fromCitizen.set(sponsorCit);
          l.toCitizen.set(targetCit);
          l.level = 2;
        });
        isNew = true;
      }
    });

    return isNew;
  }

  /**
   * Procesa una revocación de Visa ocurrida en la red de 2º o 3er grado.
   */
  async processNetworkRevocation(
    sponsorNpub: string,
    targetNpub: string,
    currentNpub?: string
  ): Promise<boolean> {
    const mainCit = await this.getMainCitizen(currentNpub);
    if (!mainCit) return false;

    if (targetNpub === mainCit.npub) {
      const res = await this.processVisaRevocation(sponsorNpub, currentNpub);
      return res.success;
    }

    const allCitizens = await database.collections.get('citizens').query().fetch();
    const sponsorCit = allCitizens.find((c: any) => c.npub === sponsorNpub) as Citizen;
    const targetCit = allCitizens.find((c: any) => c.npub === targetNpub) as Citizen;
    if (!sponsorCit || !targetCit) return false;

    let deleted = false;
    await database.write(async () => {
      const linksCollection = database.collections.get('trust_links');
      const allLinks = await linksCollection.query().fetch();

      const linksToDelete = allLinks.filter(
        (l: any) =>
          (l._raw.from_citizen_id === sponsorCit.id && l._raw.to_citizen_id === targetCit.id) ||
          (l._raw.from_citizen_id === targetCit.id && l._raw.to_citizen_id === sponsorCit.id)
      );

      for (const link of linksToDelete) {
        await link.destroyPermanently();
        deleted = true;
      }
    });

    return deleted;
  }
}
