import { database } from '../../infrastructure/database';
import Citizen from '../../infrastructure/database/Citizen';
import { UnifiedCitizenProfile } from '../models/Citizen';
import { ICitizenRepository } from './ICitizenRepository';
import { GraphTopology } from '../models/GraphTopology';

export class CitizenRepository implements ICitizenRepository {
  /**
   * Obtiene la red de ciudadanos hidratada, fusionando los datos públicos de la red 
   * con los datos locales (privados) del dispositivo para mantener la separación SOLID.
   */
  async getHydratedCitizens(): Promise<GraphTopology> {
    const allCitizens = await database.collections.get('citizens').query().fetch();
    const allLinks = await database.collections.get('trust_links').query().fetch();
    const allProvinces = await database.collections.get('provinces').query().fetch();
    const allMemberships = await database.collections.get('citizen_provinces').query().fetch();

    const citizensList: UnifiedCitizenProfile[] = [];
    const provincesList: any[] = []; // Using any for WatermelonDB models temporarily
    const simLinks: any[] = []; // We will map this to TrustLink

    const mainCit = allCitizens[0] as Citizen;
    if (!mainCit) return { citizens: [], provinces: [], links: [] };

    const citizenMapDomain = new Map<string, UnifiedCitizenProfile>();

    const addNode = (cit: Citizen, level: number) => {
      if (!citizenMapDomain.has(cit.id)) {
        citizenMapDomain.set(cit.id, {
          networkData: {
            id: cit.id,
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
      }
    };

    const addProvince = (prov: any) => {
      provincesList.push({
        id: prov.id,
        name: prov.name || 'Provincia Desconocida',
        founderId: 'unknown',
        createdAt: new Date(),
        level: -1,
      });
    };

    // Agregar el nodo principal (Nivel 0)
    addNode(mainCit, 0);

    // Map para O(1)
    const citizenMap = new Map(allCitizens.map(c => [c.id, c as Citizen]));

    // Ordenamos por nivel para procesar radialmente desde el centro
    const sortedLinks = allLinks.sort((a, b) => (a as any).level - (b as any).level);

    sortedLinks.forEach((link) => {
      const sourceId = (link as any)._raw.from_citizen_id;
      const targetId = (link as any)._raw.to_citizen_id;
      const level = (link as any).level;

      const targetCitizen = citizenMap.get(targetId);

      // Si existe y su padre ya fue procesado
      if (targetCitizen && citizenMapDomain.has(sourceId)) {
        addNode(targetCitizen, level);
        simLinks.push({ sourceId, targetId, level, type: 'TRUST' });
      }
    });

    // Agregar provincias
    allProvinces.forEach(p => addProvince(p));

    // Agregar links de membresía (Ciudadano -> Provincia)
    allMemberships.forEach(m => {
      const citizenId = (m as any)._raw.citizen_id;
      const provinceId = (m as any)._raw.province_id;

      if (citizenMapDomain.has(citizenId)) {
        simLinks.push({ sourceId: provinceId, targetId: citizenId, level: -1, type: 'MEMBERSHIP' });
      }
    });

    // Agregar causas (Nivel 3 / LOD 3)
    const causesList: any[] = [
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
  async createProvince(name: string, description: string): Promise<void> {
    const allCitizens = await database.collections.get('citizens').query().fetch();
    const mainCit = allCitizens[0] as Citizen;
    if (!mainCit) throw new Error("Ciudadano principal no encontrado.");

    await database.write(async () => {
      const provincesCollection = database.collections.get('provinces');
      const membershipsCollection = database.collections.get('citizen_provinces');

      // 1. Crear Provincia
      const newProv = await provincesCollection.create((p: any) => {
        // En un entorno real, aquí se generaría el shared key o nostr ID
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
        m.role = 'FOUNDER'; // O 'MEMBER', dependiendo de tu dominio
      });
    });
  }
}
