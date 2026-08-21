## Instruction File

> make sure whatever coding agent is reading is make sure to follow this properly , cuz that the main rule cum instruction of the project.

Hmmmidea is a local-first, voice-first Expo mobile app for capturing ideas before they disappear. The home experience opens directly into a low-friction recorder with live transcription, pause/resume controls, and the three latest captures. After a recording is saved, durable on-device jobs transcribe and structure it into an idea report that can be searched in the Vault, reviewed by section, discussed with an AI provider, and shared as a document.

The app has six product areas: Capture (the hero/home screen), Vault, Onboarding, Settings, Idea Detail, and Discuss. User content stays on the device: SQLite stores structured records and job state, the app filesystem stores optional source audio, and the OS keychain/keystore stores user-supplied provider credentials. Remote speech and AI services are called directly only for transcription, research, report generation, and discussion. There is no required Hmmmidea account or application backend in the initial architecture.

`/home/khvalin/Desktop/Code` is a migrated, vibe-coded prototype. Use it to understand product behavior and possible technical approaches, but do not copy it blindly or treat its code or visual design as production truth. The product map supplied by the owner defines the intended screens and features, `docs/Design.md` is the visual source of truth, and `docs/ARCHITECTURE.md` defines the product and technical boundaries for this repository.

### Do 's and Do'nt
1. dont use npm , npx or node , we use bun which is the source of truth for managing the packages running everything and all.
2. make sure to dont add the depenedecy by ur own , by writing in the files, use bun add for that
3. make sure to follow the current file strcutre make sure to dont fuck it dont add unessary shit files ,in the root or anywhere
4. make sure u follow modern coding scheme like dont hardcoding the constant in the main file , create the clear sepration between something , like frontend and internal functions
5. there's a Design.md in the /docs get that and use it that the soruce of the truth of the desgining shit
6. make sure to dont use react icon or lucid icon those are the ugliest icon according to me , use phosprus icon .
7. make sure whatever u generated end to end  add 404 page or other page dont left them to have error
8. use expo tools and external library but whatever u add ask urself do we need it or not.
9. and mostllikey the dev server mostlikely running in the background
