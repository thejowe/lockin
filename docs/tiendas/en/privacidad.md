> Revision v1.9, 11 November 2026: notifications, server language, recent activity, preferences and reminder opt-out (§2, §3, §5, §6, §7). Prepared in the repo; not applied, deployed or published. Legal review and store declarations remain pending.

> Traducción de `docs/tiendas/privacidad.md`, pendiente de revisión legal. Si cambia el original, cambia esta copia.

# cofounder Privacy Policy


**Version:** 1.9.

**Effective date:** 11 November 2026.

## 1. Who is responsible for your data

cofounder is an app for finding a cofounder among peers.

The data controller is **Joel de Torres Sainz de la Maza**, residing at carrer Nou, 37, 25153 Puigverd de Lleida (Catalonia, Spain). For privacy or support: **privacidad@getcofounder.app**.

We publish the app in Spain and the rest of the European Economic Area. Regulation (EU) 2016/679 (GDPR) and Spanish Organic Law 3/2018 (LOPDGDD) apply. The supervisory authority is the Spanish Data Protection Agency ([aepd.es](https://www.aepd.es)); in Catalonia you can also go to the Autoritat Catalana de Protecció de Dades.

## 2. What data we process

### Your account

The app can create an account without asking you for an email. Even if access is "anonymous", an account identifier is assigned that links your profile and your activity.

You can add and confirm an email and a password to recover the account from another device; sign-up and sign-in by email are also available. Your email is not part of the profile other people see.

**Phone (optional).** You can add a contact phone number in Settings > Personal information. It is private: it does not appear on your profile and nobody else in the app sees it. We do not verify it by SMS. You can change or remove it whenever you want from that same screen. It is deleted with the account.

**If you delete your account.** To prevent a new account from being created with the same email, we keep an encrypted fingerprint (SHA-256 hash) of each email associated with the deleted account, including those received through Google, Apple or GitHub. We do not keep the email itself or any other account data. If you want to use that email again, you can send an **unblock request** from the app: we keep the email you enter and the reason you give in order to review it and reply to you.

**Sign-in with Google or Apple (optional).** If you sign in with Google or Apple, that service confirms your email to us and the authentication service stores the basic data it sends: with Google, your email, your name and the address of your account photo; with Apple, your email (which may be an Apple forwarding address if you choose to hide it). We use them only to identify your account; they are not published on your profile. If you sign in with Apple from an iPhone, our server also stores a technical code issued by Apple (a refresh token) for one sole purpose: asking Apple to remove the app's access to your Apple ID when you delete the account. It is not used for anything else, does not leave the server and is deleted with the account.

If you verify your GitHub link, your GitHub identity is linked and the name of that account and the verification date are published next to the "GitHub verified" badge. The badge indicates that the GitHub link belongs to you; it does not prove your identity or your knowledge. The authentication service may receive other GitHub metadata depending on the provider's configuration.

### Your profile

We store the name and age you give, your city or area and time zone, avatar initials and colour, the specialties you are good at and are looking for (and, if you choose "Other", the text you write), the languages you speak and are looking for, your starting point, weekly availability and time slots, ambition level, optional links to GitHub, portfolio, LinkedIn, Instagram and TikTok, and your short answers to profile questions, with the creation and modification dates.

Location is written as text; the app does not use GPS.

**Profile photo (required to create your profile).** When you create your profile, the app asks you for a photo: without it you cannot finish signing up. The photo is first stored in a private space and our server sends it to **OpenAI** (only the image, without your name or the rest of your profile) for the sole purpose of checking that it is appropriate. The review is automatic. It is only published, visible to other people on the app, if it passes that review. If the review service is not available, the photo is not published. If you think it was rejected by mistake, write to us at soporte@getcofounder.app and a person will review it (see §8). Afterwards you can change or remove it from your profile whenever you want, and it is removed when you delete your account (see §7).

**Board (optional).** You can post up to 12 photos on your profile, for example of your work, each with optional text of up to 280 characters. Before publication, our server sends the photo and its text to **OpenAI** (without your name or the rest of your profile) to check that they are appropriate; if they do not pass the review or it cannot be done, they are not published. If you think a photo was rejected by mistake, write to us at soporte@getcofounder.app and a person will review it (see §8). You can remove each photo whenever you want.

### Your activity and conversations

We store your swipe decisions (interested or pass), the time of each like and Super Like and the Boosts you activate (to apply the daily and weekly limits), mutual matches and chat text messages, with their participants and dates. We also store the blocks and reports you make or receive: who blocks or reports, whom, the chosen reason, the optional text you add (up to 500 characters) and the date (see §7). Blocks are visible only to the person blocking; reports are not seen by any other person on the app.

### Groups

If you create or join a group, we also process:

- **Group data:** name, description or project, who the admin is, creation date and capacity (maximum 6 people).
- **Profiles the group is looking for:** the specialties and number of open or filled slots set by the admin (this is not a job offer).
- **Membership:** who belongs to the group, which profile they cover in the group and the join date.
- **Group swipes:** whether you like or pass on a group, and whether the admin likes or passes on a candidate (tied to the profile they would cover).
- **Group chat messages:** the text, who sent it, the group and the dates. All group members can see them. You can report a specific message.
- **Group blocks and reports:** if you block a group (it becomes a permanent pass and the admin is blocked) or report it (the report is filed against the admin, with the group noted).

The public part shown to people looking for a group (name, description, sought profiles and current members' public profiles) is exposed only through the deck functions, not as free reads of the internal tables. Internal group data (including detailed membership and chat) is accessible only to members, under the server's access controls.

### Notifications and preferences

If you allow notifications, we store a technical device identifier (an Expo token using Apple Push Notification service or Google Firebase Cloud Messaging). We use it for likes, matches, direct (1:1) and group messages, group activity (joining, removal and applications), optional reminders about pending likes or messages, and Premium expiry. You can turn off each type in **Settings > Notifications**; all are initially enabled. We attempt a like summary at most once a day around 11:00 in your time zone, at least 20 hours apart. Reminders are limited to once every seven days after at least three days away, only with pending likes or messages, between 10:00 and 20:00. Premium expiry alerts are attempted about 24 hours before expiry, between 09:00 and 22:00. Messages, matches and group activity can notify you when they occur.

We store the app language (Spanish, English or Catalan), preferences, recent activity time (updated at most once every 15 minutes), when you opened incoming likes and notification timestamps on our server. These allow us to translate alerts, avoid duplicates and reminders after recent visits, and identify unseen likes. Your declared IANA profile time zone determines local time; we fall back to Europe/Madrid if invalid. Opening incoming likes marks pending likes as seen even without Premium.

Notifications may contain another person's or group's name and a message preview of up to 140 characters. **Like notifications without Premium show only the count, never names or photos of the people who liked you**; with Premium they may include a name. Content may appear on your lock screen depending on device settings. These data are not used for third-party advertising or tracking. The token is deregistered on sign-out (retried if unsuccessful) and deleted with your account. If you revoke device permission, we check on return to the foreground and attempt to remove the server token. Processors: Expo (650 Industries, USA), Apple and Google (§5).

### Your subscription (optional)

If you subscribe to cofounder Premium, we store the status of your subscription: the product (monthly or yearly), the store and the date until which it is paid, with the date of the last update. To show you the plans and validate the purchase we use **RevenueCat**, which identifies you with the same app account identifier from the moment you open the Premium screen, whether you buy or not. Payment is charged by Apple or Google: we do not receive or store your card or payment method details.

### Device data and technical services

The app stores on the device the authentication session and temporary data to complete GitHub linking or sign-in with Google or Apple. On Android and iOS the session is stored in the system's secure store (Keystore / Keychain); in the web version, in the browser's local storage.

To download updates, Expo/EAS receives a random installation identifier, the platform, the version and metadata about updates and possible startup failures. It is not an advertising identifier.

The authentication, database, storage and update services receive network data such as the IP address and may generate technical logs. We do not use them for advertising or profiling.

### Cookies and local storage

The public website https://getcofounder.app does not use cookies, analytics, advertising or tracking pixels. The app does not include any advertising or analytics SDK either.

If you open the web version of the app, the session is stored in the browser's local storage so you do not have to sign in again. It is not a tracking cookie: it only keeps you signed in and you can clear it from your browser settings. Details are in the [cookie policy](https://getcofounder.app/cookies).

## 3. What we use the data for and on what legal basis

We use the data to maintain and recover your account, show and edit your profile, show you profiles, resolve mutual interest, enable chat with your matches, create and join groups, talk in the group chat, verify your GitHub link, enable sign-in with Google or Apple, review profile and board photos, handle blocks and reports, activate Premium if you subscribe and serve app updates. We do not use advertising SDKs or commercial analytics.

- **Performance of the service you request** (art. 6.1.b GDPR): account, profile (including the profile photo, which is required to create it), swipes, matches and messages (including group chat messages), group membership and group swipes, the Premium subscription if you subscribe and the unblock request if you send one.
- **Consent** (art. 6.1.a): phone, board photos, GitHub verification and sign-in with Google or Apple, all optional. You can withdraw it by removing the phone or the board photos, unlinking GitHub or deleting the account. Access to the camera, the gallery and notifications is a device permission that you grant and withdraw in its settings (§6).
- **Legitimate interest** (art. 6.1.f): security, abuse prevention (including preventing the email of a deleted account from being reused), review of photos and reports and technical operation.
- **Legal obligation** (art. 6.1.c): responding to requests from the authorities.

Likes, matches, messages, group activity and Premium expiry alerts form part of the service (art. 6.1.b GDPR). Optional reminders rely on our legitimate interest in helping you resume unanswered conversations or interests (art. 6.1.f). You can object at any time by turning off **Reminders** in Settings without affecting the service. System permission does not replace this opt-out.

## 4. Who can see them

- **Your profile (including your approved photo, board photos and links) can be seen by anyone with an account on the app**, including accounts created without an email, not just your matches. Do not include information you do not want to share. If there is a block between two people, in either direction, neither can see the other's profile, photo or board: not only does the app stop showing them, the server does not deliver them either.
- **Approved photos (profile and board) are stored in a private space and only served through temporary links** (they expire in one hour) to people signed in to the app; there is no permanent public address. A temporary link someone already had keeps working until it expires.
- Only you see your swipe decisions; the system uses them to detect mutual interest.
- Only the two people in a match see their conversation.
- The name, description, profiles a group is looking for and the public profiles of its current members can be seen by people with an account who use the Groups deck (for example, to decide whether the group interests them).
- Only group members see their group chat and the internal membership data.
- If there is a block between you and a member of a group, that group does not appear in your deck; the admin does not see candidates blocked with any member; and in the group chat you do not see messages from someone you have blocked.
- Operators with administrative access and providers may access data to the extent necessary to provide the service. Chat (1:1 and group) is stored in the database and does not have end-to-end encryption.

## 5. External services and transfers

- **Supabase** (processor): authentication, database, photo storage and real-time communication. Hosted in the EU Central region (Frankfurt).
- **OpenAI** (processor, USA): automatic review of profile photos and board photos with their text, only if you upload them. It receives the image (and, on the board, the text) from our server. This is a transfer outside the EEA (see below). We use its moderation service (`omni-moderation-latest`). According to OpenAI's public documentation (consulted on 16 Oct 2026), data sent to its API is not used to train its models unless the customer authorises it, and the moderation service does not retain content for abuse monitoring; an image detected as child sexual abuse material may be retained for manual review. These conditions are OpenAI's and may change. OpenAI's data processing agreement (DPA) is part of the conditions governing the use of its API.
- **Brevo** (processor, Sendinblue SAS, France): sending account confirmation and recovery emails. It receives your email address and the content of that message. Brevo records, without associating it with a contact, whether the email is opened and whether its link is tapped, and the confirmation link passes through a Brevo server before reaching us. We will ask Brevo to turn off this tracking and will update this point when it does.
- **RevenueCat** (processor, RevenueCat, Inc., USA): shows the Premium plans, validates purchases with Apple or Google and maintains the subscription status. It receives your account identifier and technical data about the device and the store when you open the Premium screen, even if you do not buy, and, if you buy, the purchase data (product, dates, store and country). This is a transfer outside the EEA (see below).
- **Expo / EAS** (processor, 650 Industries, USA): app updates and all notification types described in §2. **Apple Push Notification service** and **Google Firebase Cloud Messaging** also act as processors; they receive the token and content (name, message preview or like count; never a like identity without Premium), under Standard Contractual Clauses / the EU-US Data Privacy Framework.
- **GitHub** (independent controller): only if you verify your link.
- **Google** and **Apple** (independent controllers): if you sign in with their account, and if you subscribe to Premium, because they charge the subscription with your account in their store. Each processes that sign-in and that payment under its own privacy policy.

OpenAI and RevenueCat process data outside the European Economic Area (USA). For RevenueCat, the transfer relies on the European Commission's standard contractual clauses, incorporated into its data processing agreement. For OpenAI, on the standard contractual clauses or on the EU-US Data Privacy Framework (DPF), as applicable. You can request information about these safeguards at soporte@getcofounder.app.

When you open another person's portfolio, GitHub, LinkedIn, Instagram or TikTok link, you visit an external service with its own privacy practices.

## 6. Permissions

Notification permission is requested contextually when you see received likes, make a match or enter a group or its chat, never on the welcome screen. You can decline and keep using the app. If already granted, the token is refreshed on startup. Settings > Notifications lets you disable each type. If system permission is denied, we offer a link to device settings without repeatedly prompting.

The app asks for access to your gallery or camera when you add a profile or board photo. Because the profile photo is required to create your profile, during sign-up you will need to allow one of the two (if your system offers it, you can grant access only to the photos you choose).

To complete the profile, the app asks for name, date of birth, area, availability, at least one short answer and a profile photo. Email, phone, links, board and GitHub verification are optional.

## 7. How long they are kept

Language, preferences, activity and seen-like timestamps, notice marks and dispatch reservations are deleted with your account. Technical reservations contain no photos or message text and are replaced on the next attempt, blocking simultaneous retries for 15 minutes. Group activity events contain identifiers and dates only, are purged after seven days and deleted with the related group or account.

We keep your data while your account exists. When you delete the account from the app (Settings > Account > Delete my account) your profile and associated data are deleted immediately. When the account is deleted, the server also tries to remove your photos from storage (the profile photo, the board photos and any pending upload) and, in any case, they stop being accessible. If any of these removals fails, a file with no link or metadata may remain in storage until we remove it, and the provider's backup systems may keep a technical residue; if you need confirmation of removal, write to us at soporte@getcofounder.app. If you signed in with Apple from an iPhone, before deleting the account we ask Apple to remove the app's access to your Apple ID; if Apple does not respond, the account is deleted anyway and you can remove that access yourself in Settings > your name > Sign in with Apple.

- **Inactive accounts:** we do not delete them for inactivity. If we do so in the future, we will state it here with the period and will notify anyone with an email beforehand.
- **Provider backups:** may retain deleted data for up to 30 more days.
- **Technical logs** (IP, requests): according to each provider's configuration, not exceeding 90 days in our operation.
- **Abuse reports:** kept for at most 12 months from their creation and deleted automatically. If one of the accounts involved is deleted, the report is kept until that deadline, with the internal identifier as a reference.
- **Rejected photos or photos pending review:** after each review, approved or rejected, the server deletes the pending upload file. If that deletion fails, a scheduled task deletes pending uploads older than 24 hours every hour. A rejected photo is neither published nor kept.
- **Approved photo:** until you remove it or delete the account; the previous copy is removed when it is replaced.
- **Board photos:** until you remove them or delete the account; removing one deletes the file and its text.
- **Email fingerprint of a deleted account:** kept while the email remains blocked, with no fixed period, and deleted when we approve an unblock request. You can object by writing to privacidad@getcofounder.app (§8).
- **Unblock requests:** the email and the reason are kept while we review the request and, afterwards, as a record of the decision. They are not currently deleted automatically; you can ask us to delete them at privacidad@getcofounder.app.
- **Subscription status:** while the account exists; it is deleted with it. Purchase records are kept by Apple or Google and RevenueCat under their own policies and legal obligations. Deleting the account does not cancel the subscription in the store.
- **Group membership and group swipes:** while the account and the group exist. If you leave, are removed or delete your account, your membership and swipes with that group are deleted (prior likes between you and the group become a permanent pass so you do not rejoin on your own). If the admin deletes their account or leaves, leadership passes to the longest-standing member; if the group is empty, the group and its chat are deleted.
- **Group chat messages:** while the group exists. The ones you sent are deleted when you delete your account (leaving the group does not delete them); the rest are deleted with the group.

Deleting an account also deletes its matches and the messages in those conversations (including those written by the other person), its group membership and group swipes, and applies the leadership or group deletion rule if the group was left empty.

Signing out or uninstalling the app does not delete data from the server. Signing out can make an account without a confirmed email unrecoverable.

## 8. Your rights

You can edit your profile, remove your photo and board photos and unlink GitHub (the badge and the derived link are removed). The app does not allow editing or deleting individual messages.

The review of profile and board photos is automatic (§2). You have the right to have a person review a rejection, to express your point of view and to challenge the decision: write to privacidad@getcofounder.app and we will respond within the same 30-day period.

You can delete your account from the app or request it at soporte@getcofounder.app or at https://getcofounder.app/eliminar-cuenta; we respond within 30 days at most. You also have the right of access, rectification, erasure, objection, restriction and portability, which you can exercise through the same email, and the right to complain to the AEPD.

If you deleted your account and want to use its email again, send an unblock request from the app (it appears when you try to sign in or sign up with that email) explaining the reason. A person reviews it and we reply to that email.

## 9. Minors

cofounder is for people aged **16 or older**. Age is self-declared and there is no document verification or parental controls. If we detect an account belonging to someone under 16, we will delete it. If you think this is happening, write to us.

People aged 16 and 17 are minors and may use the app. Their profile, like anyone else's, is visible to any account on the app (see §4), and they can block and report other people at any time. Do not include on your profile any data you would not want an unknown adult to see.

## 10. Security, moderation and changes

The server applies access controls by account, by membership of a match and by membership of a group. Real-time group chat communication is authorised only for members. Connections with our providers use TLS. We do not promise end-to-end encryption or security certifications.

You can **block and report** another person from the app. You can also block or report a group (the report is filed against the admin) and report group chat messages. We review reports and act on content or accounts that breach the [community guidelines](https://getcofounder.app/normas) and the [terms of use](https://getcofounder.app/terminos). Our child safety standards are at https://getcofounder.app/seguridad-infantil.

If we change this policy in a significant way, we will notify you in the app and, if you have an email, by email, at least 30 days before it takes effect.


> Revision v1.9, 11 November 2026: notifications, server language, recent activity, preferences and reminder opt-out (§2, §3, §5, §6, §7). Prepared in the repo; not applied, deployed or published. Legal review and store declarations remain pending.
