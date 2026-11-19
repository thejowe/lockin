# English (U.S.) App Store listing for the Groups and Premium build

This copy covers the 1.0.1 draft with Groups, group chat and cofounder Premium. A copy of the public-facing fields accompanies the artwork. [English campaign copy](../../../appleimatges/listing.md)

## Name

cofounder – Startup Match

## Subtitle

Find a business partner

## Promotional text

Find the designer who can bring your prototype to life, or the developer who can build what you’ve sketched. A mutual like opens a private chat.

## Description

Maybe you can build a prototype in a weekend. Maybe you know the first ten people who’d try it. Find a cofounder whose skills complement yours, even if you’re still figuring out what to build.

What would working with you look like? Tell people what you do well, what you need a hand with and how many hours a week you can give a project. Add a short answer in your own words, link your portfolio or verify that a GitHub account belongs to you.

Explore one profile at a time. Compare skills, schedules and ambitions, then like the people you’d want to work with. If they like your profile too, a private chat opens.

“What could we test this Saturday?” is one way to start. Ask your own question or pick a conversation starter in the app. The first thing you try together is up to you.

If your idea needs a few more hands, create or join a group of up to six. See which skills the group is looking for and talk with the other members in a shared chat.

You can block or report people and groups, report messages, and delete your account and data in the app. The minimum age to use cofounder is 16.

cofounder Premium is an optional monthly or yearly subscription. Payment is charged to your Apple account. Your subscription renews automatically unless you cancel at least 24 hours before the end of the current period. Manage or cancel it in your Apple account settings.

Terms of Use (EULA)
https://getcofounder.app/en/terminos/

Privacy Policy
https://getcofounder.app/en/privacidad/

## Keywords

entrepreneur,technical,founder,developer,designer,collaborator,team,venture,side,project,ideas,solo

## What’s New in This Version

The “GitHub verified” badge now follows your app language in English and Catalan. This update also includes design improvements and bug fixes.

## URLs

| Field | Destination |
| --- | --- |
| Marketing | https://getcofounder.app/en/ |
| Support | https://getcofounder.app/en/soporte/ |
| Privacy policy | https://getcofounder.app/en/privacidad/ |
| Terms of Use (EULA) | https://getcofounder.app/en/terminos/ |
| Community Guidelines | https://getcofounder.app/en/normas/ |

## Category

Primary: **Social Networking** (D07). Secondary: **Business**.

## Age rating

Minimum age: 16, self-declared. In the App Store Connect questionnaire, declare: user-generated content (profiles, photos, answers, groups and 1:1 and group chat), messaging between users, no advertising, no gambling and no unrestricted web access. Since the Premium version there are in-app purchases (subscription); this does not change the age declaration. Do not lower the rating Apple calculates; if it is below 16, raise it.

| Capability | This version |
| --- | --- |
| User-generated content | Yes: profile, profile photo (required at sign-up, moderated before publication), short answers, group names and descriptions, sought profiles and messages |
| Messaging / chat | Yes, 1:1 after a mutual match and group chat among members |
| Block / report | Yes: profiles, group blocking/reporting and individual 1:1 and group chat messages (confirm in the build) |
| Content filter | Yes: basic filter for profile text, plus photo moderation |
| Acceptance of Terms and Guidelines | Yes, mandatory before publishing |
| Advertising / gambling | No |
| In-app purchases | Yes: cofounder Premium subscription, monthly (`app.cofounder.mobile.premium.monthly`, €4.99) or annual (`.annual`, €39.99), with a free trial (7 days on the annual plan, 3 on the monthly). Premium only extends features of the app itself |
| Parental controls / age verification | No; self-declared age |

## Limits

| Field | Used | Limit |
| --- | ---: | ---: |
| Name | 25 characters | 30 |
| Subtitle | 23 characters | 30 |
| Promotional text | 144 characters | 170 |
| Description | 1487 characters | 4,000 |
| Keywords | 99 UTF-8 bytes | 100 |
| What’s New in This Version | 142 characters | 4,000 |
| App Review Notes | 3437 characters | 4,000 |

Counts include line breaks. The app’s bundle ID is `app.cofounder.mobile`. [Apple’s field specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/)

## App Review Notes

Paste the fenced text into App Review Notes after the demo account details have been filled in.

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
- A basic filter checks profile text in Spanish, English and Catalan. People can
  report individual messages in private and group chats. Profile photos are
  moderated server-side with OpenAI's moderation API and are
  only published after approval (fail-closed).
- Account deletion: Settings > Account > Delete my account removes profile,
  matches, messages, photo, group membership, group swipes and push tokens.
  If the admin leaves or deletes their account, the longest-standing member
  becomes admin; an empty group and its chat are deleted.
- Contact: soporte@getcofounder.app. Child-safety standards:
  https://getcofounder.app/en/seguridad-infantil/

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
