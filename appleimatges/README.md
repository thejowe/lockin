# English App Store campaign

[View all seven designs](preview.jpg) · [See the first three at mobile search size](search-preview.jpg) · [Compare the designs with three U.S. listings](comparison.html) · [Read the English listing](listing.md)

The English (U.S.) localization is saved in the iOS 1.0.1 draft. App Store Connect processed all 14 screenshots in numbered order and its source checksums match the local PNGs. Version 1.0 is still the public release. [Open the draft in App Store Connect](https://appstoreconnect.apple.com/apps/6828604279/distribution/ios/version/d9bb9783-aa1a-4438-9196-53a1b928d83f)

## iPhone artwork

The numbered PNGs are in display order. The large set is 1320 × 2868 and the second set is 1179 × 2556. Both use opaque RGB. The overview and search-size images are local proofs.

| Frame | Headline | 1320 × 2868 | 1179 × 2556 |
| --- | --- | --- | --- |
| Swipe deck | Swipe to find a cofounder. | [PNG](screenshots/01-discover.png) | [PNG](screenshots/1179x2556/01-discover.png) |
| Complementary skills | Match on skills. | [PNG](screenshots/02-matches.png) | [PNG](screenshots/1179x2556/02-matches.png) |
| Chat | Plan your first test. | [PNG](screenshots/03-chat.png) | [PNG](screenshots/1179x2556/03-chat.png) |
| Profile | Show what you bring. | [PNG](screenshots/04-profile.png) | [PNG](screenshots/1179x2556/04-profile.png) |
| Profile prompts | See how they think. | [PNG](screenshots/05-prompt.png) | [PNG](screenshots/1179x2556/05-prompt.png) |
| Groups | Find your crew. | [PNG](screenshots/06-groups.png) | [PNG](screenshots/1179x2556/06-groups.png) |
| Mutual match | It starts with two. | [PNG](screenshots/07-matched.png) | [PNG](screenshots/1179x2556/07-matched.png) |

## Icon and source

Every poster uses the supplied white-on-black wordmark. The 1024 × 1024 icon and its portable Icon Composer source are identical to the repository originals. The iOS configuration uses the original package under `assets/expo.icon`. [Official icon](icon/cofounder-1024.png) · [Icon Composer source](icon/cofounder.icon/icon.json) · [Official wordmark](source/official-wordmark.png)

The English UI was captured from cofounder’s mobile web build with fictional profiles. The cover freezes a rightward drag on Maya’s card, revealing Alex underneath and the app’s Like heart. All screen excerpts come from the app. The artwork depicts the feature set prepared for 1.0.1. Compare it with the selected native iOS build before submission. [UI sources and capture details](source/ui/README.md)

Edit the headlines and layout in [artwork.html](source/artwork.html). With Playwright available to Node, run `node appleimatges/source/export.cjs` from the repository root for the full gallery or `node appleimatges/source/export.cjs discover` for the cover in both sizes. The exporter uses Edge on Windows and Chromium on other platforms.

## Search performance

After release, compare App Store Search impressions and downloads in App Analytics for the same storefront and comparable time periods. Those observations can show whether more people found and installed cofounder after the change. Apple also considers user behavior when ordering results. [Apple’s search guide](https://developer.apple.com/app-store/search/)
