> Translation of `docs/tiendas/ficha-app-store.md`, without native review. If the Spanish original changes, change this copy. English is the primary language of the store listing.

# cofounder — App Store listing (English)

Reviewed on 7 November 2026 against the Spanish listing. Copy only the content of each field.

Updated on 9 November 2026 with Groups, group chat and optional push notifications; content prepared for the build with Groups.

## Name

cofounder

## Subtitle

Find who to build with

## Promotional text

Swipe through people who want to start something, match when the interest is mutual, and chat to see if you fit as cofounders.

## Description

Want to build something but need someone to build it with? cofounder helps you find a cofounder among people at a similar point to yours.

You don't need to have built anything. You can have no idea yet, an idea you haven't started, or have tried something small. Here nobody hires anybody: the relationship is between peers, and you both contribute and decide together.

YOUR PROFILE
Tell people who you are and what you bring: name, age, location and time zone, specialties, starting point, availability and level of ambition. Answer one or two short questions so your way of thinking shows, not just what you can do. If you like, add links to GitHub, your portfolio or LinkedIn.

To create your profile you add a photo, which is only published after passing an automatic safety review.

SWIPE
Profiles appear full screen, one by one. Swipe to show you're interested in someone or to move on to the next.

MATCH AND CHAT
When the interest is mutual, you match and a private chat opens between the two of you. To break the ice, the app suggests a few questions to start with.

GROUPS
Besides 1:1 matching, you can create or join a group to complement profiles on a project (max 6 people), see who is in it and talk in a group chat. Nobody hires anybody: it remains peer-to-peer.

VERIFIED GITHUB
You can link your GitHub account to show "GitHub verified" on your profile. It indicates that the GitHub link belongs to whoever publishes it; it does not verify the person's identity or knowledge.

SAFETY AND CONTROL
You can block or report anyone from the app. You can also block or report a group and report a group chat message. You can delete your account and your data whenever you want from Settings > Account.

WHAT IT IS NOT
cofounder is not a dating app or a job board. It offers no legal advice or funding, and does not guarantee results: it helps you meet people to build with; what you do together is up to you.

For people aged 16 or over.

SUBSCRIPTION
cofounder Premium is an auto-renewable subscription (monthly or yearly). Payment is charged to your Apple account and renews automatically unless you cancel at least 24 hours before the end of the period; manage or cancel it in your Apple account settings.

Terms of Use (EULA): https://getcofounder.app/terminos
Privacy Policy: https://getcofounder.app/privacidad

## Keywords

partner,startup,entrepreneur,founder,cofounder,project,team,idea,business,collaborate,github,peers

## URLs

- Privacy policy: https://getcofounder.app/privacidad
- Support: https://getcofounder.app/soporte
- Terms of Use (EULA): https://getcofounder.app/terminos
- Community Guidelines: https://getcofounder.app/normas

Pending the multilingual website: when `web/` publishes English pages, the privacy policy and terms can point to `/en/...` (and `/ca/...` for Catalan). Until then, the registered URLs (without a language prefix) are the ones to use.

## Category

Primary: **Social Networking** (D07). Secondary: **Business**.

## Age rating

Minimum age: 16, self-declared. In the App Store Connect questionnaire, declare: user-generated content (profiles, photos, answers, groups and 1:1 and group chat), messaging between users, no advertising, no gambling and no unrestricted web access. Since the Premium version there are in-app purchases (subscription); this does not change the age declaration. Do not lower the rating Apple calculates; if it is below 16, raise it.

| Capability | This version |
| --- | --- |
| User-generated content | Yes: profile, profile photo (required at sign-up, moderated before publication), short answers, group names and descriptions, sought profiles and messages |
| Messaging / chat | Yes, 1:1 after a mutual match and group chat among members |
| Block / report | Yes: profiles, group blocking/reporting and individual 1:1 and group chat messages (confirm in the build) |
| Content filter | Yes: basic text filter on profile and chat, plus photo moderation |
| Acceptance of Terms and Guidelines | Yes, mandatory before publishing |
| Advertising / gambling | No |
| In-app purchases | Yes: cofounder Premium subscription, monthly (`app.cofounder.mobile.premium.monthly`, €4.99) or annual (`.annual`, €39.99), with a free trial (7 days on the annual plan, 3 on the monthly). Premium only extends features of the app itself |
| Parental controls / age verification | No; self-declared age |

## Limits

| Field | Text | Limit |
| --- | --- | --- |
| Name | 9 characters | 30 |
| Subtitle | 22 characters | 30 |
| Promotional text | 126 characters | 170 |
| Description | 2328 characters | 4000 |
| Keywords | 98 bytes | 100 |
| App Review Notes | 3379 characters | 4000 |

The keywords do not repeat the name or the category (Apple already indexes them) and use no third-party names except "github", which describes a real feature (GitHub verified). Bundle ID: `app.cofounder.mobile`; version 1.0.0.

## App Review Notes

Text to paste into App Store Connect (in English, the reviewer reads it in that language):

```
cofounder is a peer-to-peer app for finding a startup co-founder. Users create a
profile, swipe through other profiles, and chat 1:1 after a mutual match.
Users can also create or join groups of up to 6 people with a group chat.

HOW TO TEST
1. Sign in with the demo account below (or create an account; email is optional).
2. Accept the Terms of Use and Community Guidelines when prompted.
3. Open the Discover tab to see profiles, swipe to like/pass; the demo account
   already has a match with a chat in the Matches tab.
4. Discover > Groups: create a group with sought profiles, or like a group;
   a mutual like with its admin adds you to the group chat.
5. Settings > Account: Delete my account (in-app account deletion, Guideline 5.1.1(v)).

DEMO ACCOUNT
[test account: pending]

USER-GENERATED CONTENT (Guideline 1.2)
- Terms and Community Guidelines must be accepted (versioned, with date) before
  publishing content or chatting; links to them are in Settings.
- Report: any profile (Discover/chat safety panel) and any individual message
  (message report panel in 1:1 and group chat). Groups can also be reported;
  the report is filed against the admin, with the group noted. Reports go to a private table reviewed
  by the operator; target response time is 24 h for severe content and 72 h otherwise.
- Block: any user, from Discover or chat; blocking is mutual and immediate.
  Blocking a group permanently passes on it and blocks its admin.
- Filter: a basic objectionable-text filter (insults, threats, explicit sexual
  content; Spanish and English) blocks submission of profile text and messages
  (including group chat);
  profile photos are moderated server-side with OpenAI's moderation API and are
  only published after approval (fail-closed).
- Account deletion: Settings > Account > Delete my account removes profile,
  matches, messages, photo, group membership, group swipes and push tokens.
  If the admin leaves or deletes their account, the longest-standing member
  becomes admin; an empty group and its chat are deleted.
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
- Camera / photo library: only to take or choose the profile photo (required to create the profile) and the optional board photos.
  No microphone, no location, no contacts, no tracking.
- Optional push notifications for group chat: permission is requested when
  joining a group or opening its chat. Title: group name; body: sender name
  (if available) and a message snippet of up to 140 characters. Delivered via Expo/APNs/FCM.
- Encryption: standard HTTPS/TLS only (ITSAppUsesNonExemptEncryption = false).
- Sign in with GitHub is optional and only used to show a "GitHub verified"
  badge. The app also supports Sign in with Apple, Google, email/password and anonymous accounts, so GitHub
  is not the only login option.

AGE
Minimum age 16, self-declared.
```

`[test account: pending]` is a placeholder: do not invent credentials. Before submitting, create the account in production with a complete profile and a match with a chat, and fill in the block. The pre-submission checklist, DSA/trader status and internal notes stay in the Spanish listing.
