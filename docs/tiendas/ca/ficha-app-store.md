> Traducció de `docs/tiendas/ficha-app-store.md`, sense revisió nativa. Si canvia l'original en castellà, canvia aquesta còpia. L'idioma principal de la fitxa de la botiga és l'anglès; el català és una localització.

# cofounder — fitxa de l'App Store (català)

Revisada el 7 de novembre de 2026 contra la fitxa en castellà. Copia únicament el contingut de cada camp.

## Nom

cofounder

## Subtítol

Troba amb qui fundar

## Text promocional

Llisca perfils de gent que vol començar alguna cosa, fes match quan l'interès és mutu i xerra per veure si encaixeu com a cofundadors.

## Descripció

Tens ganes de construir alguna cosa i et falta amb qui? cofounder t'ajuda a trobar cofundador o cofundadora entre persones que són en un punt semblant al teu.

No cal tenir res construït. Pots no tenir cap idea encara, tenir una idea sense començar o haver provat alguna cosa petita. Aquí ningú no contracta ningú: la relació és entre iguals, i tots dos hi aporteu i decidiu junts.

EL TEU PERFIL
Explica qui ets i què hi aportes: nom, edat, ubicació i zona horària, especialitats, punt de partida, disponibilitat i nivell d'ambició. Respon una o dues preguntes breus perquè es noti com penses, no només què saps fer. Si vols, afegeix enllaços a GitHub, portfolio o LinkedIn.

També pots afegir una foto. És opcional i només es publica després de passar una revisió automàtica de seguretat.

LLISCA
Els perfils apareixen a pantalla completa, un a un. Llisca per indicar que t'interessa una persona o per passar a la següent.

MATCH I XAT
Quan l'interès és mutu, feu match i s'obre un xat privat entre els dos. Per trencar el gel, l'app et suggereix algunes preguntes per començar.

GITHUB VERIFICAT
Pots vincular el teu compte de GitHub per mostrar «GitHub verificat» al teu perfil. Indica que l'enllaç de GitHub pertany a qui el publica; no verifica la identitat de la persona ni els seus coneixements.

SEGURETAT I CONTROL
Pots bloquejar o reportar qualsevol persona des de l'app. Pots eliminar el teu compte i les teves dades quan vulguis des de Perfil > Compte.

QUÈ NO ÉS
cofounder no és una app de cites ni una borsa de treball. No ofereix assessorament legal ni finançament, ni garanteix resultats: t'ajuda a conèixer persones amb qui construir; el que feu depèn de vosaltres.

Per a persones de 16 anys o més.

## Paraules clau

soci,emprendre,startup,emprenedor,cofundadora,projecte,equip,idea,negoci,col·laborar,github,iguals

## URL

- Política de privacitat: https://getcofounder.app/privacidad
- Suport: https://getcofounder.app/soporte
- Termes d'ús (EULA): https://getcofounder.app/terminos
- Normes de la comunitat: https://getcofounder.app/normas

Pendent de la web multilingüe: quan `web/` publiqui pàgines en català, la política de privacitat i els termes podran apuntar a `/ca/...` (i a `/en/...` per a l'anglès). Fins llavors, s'usen les URL registrades (sense prefix d'idioma).

## Categoria

Principal: **Xarxes socials (Social Networking)** (D07). Secundària: **Negocis (Business)**.

## Classificació d'edat

Edat mínima d'ús: 16 anys, autodeclarada. Al qüestionari d'App Store Connect cal declarar: contingut generat per usuaris (perfils, fotos, respostes i xat 1:1), missatgeria entre usuaris, sense publicitat, apostes ni accés web sense restriccions. Des de la versió amb Premium sí que hi ha compres dins l'app (subscripció); no canvia la declaració d'edat. No reduir la classificació que calculi Apple; si és inferior a 16, elevar-la.

| Capacitat | Aquesta versió |
| --- | --- |
| Contingut generat per usuaris | Sí: perfil, foto opcional (moderada abans de publicar-se), respostes breus i missatges |
| Missatgeria / xat | Sí, 1:1 després d'un match mutu |
| Bloquejar / reportar | Sí: perfils i missatges concrets (confirmar a la build) |
| Filtre de contingut | Sí: filtre bàsic de text al perfil i al xat, més moderació de fotos |
| Acceptació de Termes i Normes | Sí, obligatòria abans de publicar |
| Publicitat / apostes | No |
| Compres dins l'app | Sí: subscripció cofounder Premium, mensual (`app.cofounder.mobile.premium.monthly`, 4,99 €) o anual (`.annual`, 39,99 €), amb prova gratuïta (7 dies a l'anual, 3 al mensual). Premium només amplia funcions de la pròpia app |
| Controls parentals / verificació d'edat | No; edat autodeclarada |

## Límits

| Camp | Text | Límit |
| --- | --- | --- |
| Nom | 9 caràcters | 30 |
| Subtítol | 20 caràcters | 30 |
| Text promocional | 134 caràcters | 170 |
| Descripció | 1717 caràcters | 4000 |
| Paraules clau | 99 bytes | 100 |
| Notes per a la revisió | 2545 caràcters | 4000 |

Les paraules clau no repeteixen el nom ni la categoria (Apple ja els indexa) i no usen noms de tercers tret de «github», que descriu una funció real (GitHub verificat). Bundle ID: `app.cofounder.mobile`; versió 1.0.0.

## Notes per a la revisió (App Review Notes)

Text per enganxar a App Store Connect. Va en anglès a totes les localitzacions (el revisor el llegeix en aquest idioma):

```
cofounder is a peer-to-peer app for finding a startup co-founder. Users create a
profile, swipe through other profiles, and chat 1:1 after a mutual match.

HOW TO TEST
1. Sign in with the demo account below (or create an account; email is optional).
2. Accept the Terms of Use and Community Guidelines when prompted.
3. Open the Discover tab to see profiles, swipe to like/pass; the demo account
   already has a match with a chat in the Matches tab.
4. Profile > Account: Delete my account (in-app account deletion, Guideline 5.1.1(v)).

DEMO ACCOUNT
[test account: pending]

USER-GENERATED CONTENT (Guideline 1.2)
- Terms and Community Guidelines must be accepted (versioned, with date) before
  publishing content or chatting; links to them are in Profile.
- Report: any profile (Discover/chat safety panel) and any individual message
  (message report panel in the chat). Reports go to a private table reviewed
  by the operator; target response time is 24 h for severe content and 72 h otherwise.
- Block: any user, from Discover or chat; blocking is mutual and immediate.
- Filter: a basic objectionable-text filter (insults, threats, explicit sexual
  content; Spanish and English) blocks submission of profile text and messages;
  profile photos are moderated server-side with OpenAI's moderation API and are
  only published after approval (fail-closed).
- Account deletion: Profile > Account > Delete my account removes profile,
  matches, messages and photo.
- Contact: soporte@getcofounder.app. Child-safety standards:
  https://getcofounder.app/seguridad-infantil

SUBSCRIPTION (Guideline 3.1.2)
- cofounder Premium is an optional auto-renewable subscription (monthly or
  yearly; free trial for new subscribers: 7 days on yearly, 3 on monthly). It removes the daily like
  limit and adds Super Likes, undo, Boost and "who liked you". Everything else
  stays free; there are no ads.
- Premium only unlocks features inside the app. Purchases go through Apple
  In-App Purchase; "Restore purchases" and "Manage subscription" are in the
  paywall and in Settings.

PERMISSIONS
- Camera / photo library: only to take or choose the optional profile photo.
  No microphone, no location, no contacts, no push notifications, no tracking.
- Encryption: standard HTTPS/TLS only (ITSAppUsesNonExemptEncryption = false).
- Sign in with GitHub is optional and only used to show a "GitHub verified"
  badge. The app also supports email/password and anonymous accounts, so GitHub
  is not the only login option.

AGE
Minimum age 16, self-declared.
```

`[test account: pending]` és un marcador: no inventar credencials. Abans d'enviar, cal crear el compte a producció amb perfil complet i un match amb xat, i omplir el bloc. La llista de comprovacions prèvies, l'estat DSA/trader i les notes internes es queden a la fitxa en castellà.
