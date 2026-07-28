import { database } from './index';
import { Logger } from '../telemetry/Logger';
import { CitizenData, TrustLinkData } from '../../types';

/**
 * Inyecta ciudadanos falsos y conexiones (TrustLinks) en la base de datos
 * para poder visualizar el Mapa Topológico.
 */
export const injectDummyTopology = async () => {
  try {
    const citizensCollection = database.collections.get('citizens');
    const trustLinksCollection = database.collections.get('trust_links');
    const provincesCollection = database.collections.get('provinces');
    const membershipsCollection = database.collections.get('citizen_provinces');

    const existingCitizens = await citizensCollection.query().fetchCount();
    
    // Restauramos el límite a 350 para forzar un reset en tu próximo reload
    if (existingCitizens >= 350) {
      console.log('Topología masiva persistente cargada. Saltando inyección de dummy data.');
      return;
    }

    // RESET TEMPORAL: Si hay menos de 350 pero más de 1, borramos los datos dummy anteriores
    if (existingCitizens > 1) {
      console.log('Limpiando topología antigua para inyectar Stress Test de 350 nodos asimétricos...');
      const allLinks = await trustLinksCollection.query().fetch();
      const allCit = await citizensCollection.query().fetch();
      const mainCitId = allCit[0]?.id;
      
      const recordsToDelete = [
        ...allLinks,
        ...allCit.filter((c: any) => c.id !== mainCitId)
      ];

      // WatermelonDB puede ser lento borrando uno por uno si son muchos, pero en dev está bien
      await database.write(async () => {
        for (const record of recordsToDelete) {
          await record.destroyPermanently();
        }
      });
    }

    Logger.log('Inyectando datos semilla masivos (350 nodos) para la topología...');

    const allCitizens = await citizensCollection.query().fetch();
    const mainCitizen = allCitizens[0];

    if (!mainCitizen) {
      Logger.warn('No se encontró al ciudadano principal. Ve al onboarding primero.');
      return;
    }

    await database.write(async () => {
      // Nivel 1: 15 nodos (Brazos de la estrella)
      const level1Citizens: any[] = [];
      for (let i = 0; i < 15; i++) {
        const newCit = await citizensCollection.create((citizen: any) => {
          citizen.npub = `npub_dummy_l1_${i}`;
          citizen.role = 'CITIZEN';
          citizen.alias = `${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
          citizen.localName = i < 3 ? ['Juan (Panadería)', 'María (Vecina)', 'Carlos (Sindicato)'][i] : undefined;
          citizen.merit = Math.floor(Math.random() * 100);
        });
        level1Citizens.push(newCit);
        await trustLinksCollection.create((link: any) => {
          link.fromCitizen.set(mainCitizen);
          link.toCitizen.set(newCit);
          link.level = 1;
        });
      }

      // Nivel 2: 80 nodos (Hojas internas, ramas asimétricas)
      const level2Citizens: any[] = [];
      for (let i = 0; i < 80; i++) {
        const newCit = await citizensCollection.create((citizen: any) => {
          citizen.npub = `npub_dummy_l2_${i}`;
          citizen.role = 'CITIZEN';
          citizen.alias = `${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
          citizen.merit = Math.floor(Math.random() * 50);
        });
        level2Citizens.push(newCit);
        
        // Power law: eleva a la 2 o 3 para que los primeros índices se elijan mucho más (Ramas superpobladas)
        const pIndex = Math.floor(Math.pow(Math.random(), 2.5) * level1Citizens.length);
        const parent = level1Citizens[pIndex];
        
        await trustLinksCollection.create((link: any) => {
          link.fromCitizen.set(parent);
          link.toCitizen.set(newCit);
          link.level = 2;
        });
      }

      // Nivel 3: 254 nodos (Racimos externos) -> Total = 350
      for (let i = 0; i < 254; i++) {
        const newCit = await citizensCollection.create((citizen: any) => {
          citizen.npub = `npub_dummy_l3_${i}`;
          citizen.role = 'CITIZEN';
          citizen.alias = `${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
          citizen.merit = Math.floor(Math.random() * 20);
        });

        // Padre Primario Asimétrico
        const pIndex = Math.floor(Math.pow(Math.random(), 2.5) * level2Citizens.length);
        const primaryParent = level2Citizens[pIndex];

        await trustLinksCollection.create((link: any) => {
          link.fromCitizen.set(primaryParent);
          link.toCitizen.set(newCit);
          link.level = 3;
        });

        // CROSS-LINKS (10% de los nodos de nivel 3 son verificados por alguien más)
        if (Math.random() < 0.1) {
          const secondaryParentIndex = Math.floor(Math.random() * level2Citizens.length);
          if (secondaryParentIndex !== pIndex) {
            await trustLinksCollection.create((link: any) => {
              link.fromCitizen.set(level2Citizens[secondaryParentIndex]);
              link.toCitizen.set(newCit);
              link.level = 3; // Cross-link secundario
            });
          }
        }
      }

      // Nivel 3: Provincias (Agrupando algunos ciudadanos)
      Logger.log('Generando 3 Provincias...');
      const provinces = [];
      for (let i = 0; i < 3; i++) {
        const prov = await provincesCollection.create((p: any) => {
          p.pubkey = `npub_prov_${i}`;
          p.name = ['Gremio de Desarrolladores', 'Ministerio de Arte', 'Asamblea de Economía'][i];
          p.description = `Provincia simulada número ${i}`;
          p.founderPubkey = mainCitizen.id;
        });
        provinces.push(prov);
      }

      // Asignar el 30% de los ciudadanos a provincias aleatorias
      for (const cit of [...level1Citizens, ...level2Citizens]) {
        if (Math.random() < 0.3) {
          const randomProv = provinces[Math.floor(Math.random() * provinces.length)];
          await membershipsCollection.create((m: any) => {
            m.citizen.set(cit);
            m.province.set(randomProv);
            m.role = 'MEMBER';
          });
        }
      }
    });

    Logger.log('¡Topología Híbrida Inyectada con Éxito!');
  } catch (error) {
    Logger.error('Error inyectando dummy data:', error);
  }
};
