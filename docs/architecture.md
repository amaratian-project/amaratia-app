# Arquitectura de Amaratia

Amaratia es un "Estado Red de Bolsillo" (Pocket Network State) construido para la resistencia civil y economía paralela, basado en principios de local-first y topología P2P.

## Tecnologías Clave

- **React Native (Expo):** Framework para la aplicación móvil nativa (iOS y Android).
- **WatermelonDB:** Base de datos Local-First, reactiva, que opera completamente sin conexión (offline).
- **Nostr:** Protocolo de comunicaciones P2P descentralizado usado para sincronizar los perfiles y el "Web of Trust" entre dispositivos sin un servidor central.
- **Skia & Reanimated:** Motores de renderizado para visualización de los nodos y el mapa topológico a 60 FPS.
- **Quick Crypto:** Para la criptografía en el dispositivo y la lógica de Negabilidad Plausible (Plausible Deniability).

## Conceptos Core

### 1. Dual PIN (Plausible Deniability)
Amaratia no usa correos electrónicos ni contraseñas. Usa pares de llaves Nsec/Npub.
El usuario cifra su llave privada localmente mediante un PIN. Si se le obliga a abrir la aplicación bajo coacción, el usuario ingresa un "PIN Señuelo", el cual abre la aplicación en un modo `TOURIST`, ocultando su Web of Trust y acceso a los datos cívicos sensibles.

### 2. Recuperación Social (La Tribu) y Shamir's Secret Sharing
Si un ciudadano pierde su teléfono, normalmente necesitaría sus 12 palabras (Mnemónico) para recuperar su cuenta. Sin embargo, Amaratia implementa **Recuperación Social** a través de la **"Tribu"**.
- La Tribu está conformada por un máximo de 12 ciudadanos del primer anillo de confianza del usuario.
- Usando un algoritmo criptográfico llamado **Shamir's Secret Sharing (SSS)**, la llave maestra (las 12 palabras) se "rompe" en 12 fragmentos matemáticos. Cada miembro de la Tribu custodia un fragmento de forma encriptada (y sin que ellos puedan leer el contenido de tu llave).
- Si pierdes el acceso, puedes pedir a tu Tribu que acredite tu nueva instalación. Si un número mínimo (Ej. 7 de 12 miembros) aprueban tu solicitud, sus fragmentos se unen localmente en tu nuevo teléfono y reconstruyen tu llave `Nsec` mágicamente.

### 3. Web of Trust (WoT)
En Amaratia, los usuarios solo acceden a la red cívica si son escaneados (Vouch) físicamente en persona por un ciudadano existente. El sistema mantiene un grafo topológico de confianza dividido en 3 niveles de zoom:
- **Nivel 1 (Micro):** Ciudadano en el centro y 3 anillos concéntricos (Apadrinados directos, 2do y 3er grado).
- **Nivel 2 (Meso):** Agrupaciones o "Provincias".
- **Nivel 3 (Macro):** Proyectos Cívicos a gran escala.

### 3. Economía Dual
- **Mercado:** Transacciones libres P2P.
- **Mérito:** Sistema de reputación intransferible ganado por la resolución de tickets de trabajo cívico (Kanban local). Afecta la gobernanza (Voto Cuadrático) y la visibilidad de los perfiles.
