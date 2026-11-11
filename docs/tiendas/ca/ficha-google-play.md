> Traducció de `docs/tiendas/ficha-google-play.md`, sense revisió nativa. Si canvia l'original en castellà, canvia aquesta còpia. L'idioma principal de la fitxa de la botiga és l'anglès; el català és una localització.

# cofounder — fitxa de Google Play (català)

Revisada el 7 de novembre de 2026 contra la fitxa en castellà. Copia únicament el contingut de cada camp.

Actualitzada el 9 de novembre de 2026 amb Grups, xat de grup i notificacions push opcionals; contingut preparat per a la build amb Grups.

## Nom de l'aplicació

cofounder

## Descripció breu

Troba cofundador: llisca perfils, fes match i xerra d'igual a igual.

## Descripció completa

Tens ganes de construir alguna cosa i et falta amb qui? cofounder t'ajuda a trobar cofundador o cofundadora entre persones que són en un punt semblant al teu.

No cal tenir res construït. Pots no tenir cap idea encara, tenir una idea sense començar o haver provat alguna cosa petita. Aquí ningú no contracta ningú: la relació és entre iguals, i tots dos hi aporteu i decidiu junts.

EL TEU PERFIL
Explica qui ets i què hi aportes: nom, edat, ubicació i zona horària, especialitats, punt de partida, disponibilitat i nivell d'ambició. Respon una o dues preguntes breus perquè es noti com penses, no només què saps fer. Si vols, afegeix enllaços a GitHub, portafoli o LinkedIn.

Per crear el teu perfil hi afegeixes una foto, que només es publica després de passar una revisió automàtica de seguretat.

LLISCA
Els perfils apareixen a pantalla completa, un a un. Llisca per indicar que t'interessa una persona o per passar a la següent.

MATCH I XAT
Quan l'interès és mutu, feu match i s'obre un xat privat entre els dos. Per trencar el gel, l'app et suggereix algunes preguntes per començar.

GRUPS
A més del match 1:1, pots crear o unir-te a un grup per complementar perfils en un projecte (màxim 6 persones), veure qui en forma part i parlar en un xat de grup. Aquí ningú no contracta ningú: la relació continua sent entre iguals.

GITHUB VERIFICAT
Pots vincular el teu compte de GitHub per mostrar «GitHub verificat» al teu perfil. Indica que l'enllaç de GitHub pertany a qui el publica; no verifica la identitat de la persona ni els seus coneixements.

SEGURETAT I CONTROL
Pots bloquejar o reportar qualsevol persona des de l'app. També pots bloquejar o denunciar un grup i denunciar un missatge del xat de grup. Pots eliminar el teu compte i les teves dades quan vulguis des d'Ajustos > Compte.

QUÈ NO ÉS
cofounder no és una app de cites ni una borsa de treball. No ofereix assessorament legal ni finançament, ni garanteix resultats: t'ajuda a conèixer persones amb qui construir; el que feu depèn de vosaltres.

Per a persones de 16 anys o més.

## Paraules clau

Google Play no té camp de paraules clau. La descripció ja inclou de manera natural «cofundador», «emprendre», «iguals», «GitHub». No afegir blocs de paraules repetides (política de metadades).

## Categoria

Tipus: **Aplicació**. Categoria: **Social** (D07). Implica complir les normes de seguretat infantil de Google (normes públiques, mecanisme d'avís, contacte designat: D11).

## Classificació de contingut i públic objectiu

Públic objectiu: 16–17 i 18+ (D06). Al qüestionari IARC cal declarar interacció entre usuaris, contingut generat per usuaris, intercanvi de fotos (foto de perfil) i xat. No declarar vídeo ni veu: el codi de videotrucada ja no és al binari (T5). No afirmar una qualificació concreta abans del resultat oficial.

## Data safety, eliminació de compte i permisos

- Respostes de Data safety: vegeu `cuestionario-privacidad.md`.
- Eliminació de compte: a l'app (Ajustos > Compte > Elimina el meu compte) i URL web https://getcofounder.app/eliminar-cuenta (obligatòria i funcionant; explica com demanar-la per correu sense l'app).
- Seguretat infantil (categoria Social): URL dels estàndards https://getcofounder.app/seguridad-infantil; contacte designat soporte@getcofounder.app.
- Permisos (build amb Grups): càmera i galeria per a fotos, i notificacions opcionals per als missatges del xat de grup (`expo-notifications`; comprovar el permís d'Android 13+). Sense `RECORD_AUDIO` ni `SCHEDULE_EXACT_ALARM`. Confirmar el manifest final de l'AAB.
- Polítiques UGC de Google: Termes i Normes acceptats abans de publicar; denúncia de perfils i missatges 1:1 i de grup; bloqueig de perfils i bloqueig/denúncia de grups; filtre bàsic de text i moderació de fotos; revisió dels reports (24 h / 72 h).
- Compres a l'app: **«Conté compres a l'aplicació: sí»** (subscripció cofounder Premium, mensual o anual, amb prova gratuïta: 7 dies a l'anual, 3 al mensual; mensual 4,99 €, anual 39,99 €; subscripció `premium`, plans base `premium-monthly` (oferta `trial-3d`) i `premium-annual` (oferta `trial-7d`)). **«Conté anuncis: no».** Preu de l'app: gratuïta.
- Compte de prova per si Play demana accés: hola+playreview@getcofounder.app (la contrasenya no és al repo; s'introdueix a Play Console > Accés a l'app).

## Límits

| Camp | Text | Límit |
| --- | --- | --- |
| Nom | 9 caràcters | 30 |
| Descripció breu | 68 caràcters | 80 |
| Descripció completa | 2040 caràcters | 4000 |

Package: `app.cofounder.android`; versió 1.0.0. La llista de comprovacions prèvies, l'estat de trader (DSA) i les notes internes es queden a la fitxa en castellà.
