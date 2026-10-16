# Changelog

## [0.5.0](https://github.com/dreadster3/pi-web/compare/v0.4.0...v0.5.0) (2026-10-16)


### Features

* **chat:** show how long each turn took, and the running turn's elapsed time ([#1222](https://github.com/dreadster3/pi-web/issues/1222)) ([49fa89c](https://github.com/dreadster3/pi-web/commit/49fa89c92eca32b4777f1c3aa44792b0f3a53a67))
* **chat:** show pi's cache and cost notices ([#1265](https://github.com/dreadster3/pi-web/issues/1265)) ([#1267](https://github.com/dreadster3/pi-web/issues/1267)) ([653cd7c](https://github.com/dreadster3/pi-web/commit/653cd7c060ca6a7da2742bfddb527b62e094382c))
* edit managed-model context windows in Settings ([#1221](https://github.com/dreadster3/pi-web/issues/1221)) ([0e78bbe](https://github.com/dreadster3/pi-web/commit/0e78bbea260c46299c48c6e4e1176ffa24f95a36))
* **files:** drag-and-drop upload with precise subdirectory targets ([#1192](https://github.com/dreadster3/pi-web/issues/1192)) ([5ec5a74](https://github.com/dreadster3/pi-web/commit/5ec5a745f2ce1fd3eb5ffe7d40721df1c4427311))
* **files:** highlight more file types in the source view ([#1197](https://github.com/dreadster3/pi-web/issues/1197)) ([#1243](https://github.com/dreadster3/pi-web/issues/1243)) ([898eb5a](https://github.com/dreadster3/pi-web/commit/898eb5ae6b69b0156ee666be261d8c6e443c579a))
* **sidebar:** open projects in a new browser tab ([#1208](https://github.com/dreadster3/pi-web/issues/1208)) ([5e286a9](https://github.com/dreadster3/pi-web/commit/5e286a9459604979004bf8524a4432b8c0e79881))
* **terminal:** switch the terminal between dark and light ([#1268](https://github.com/dreadster3/pi-web/issues/1268)) ([#1270](https://github.com/dreadster3/pi-web/issues/1270)) ([520ce8d](https://github.com/dreadster3/pi-web/commit/520ce8d52718f4411ad7b1495154c85166869709))
* **ui:** fade scrolled edges and smooth dark-theme text ([e070e0b](https://github.com/dreadster3/pi-web/commit/e070e0b7322fc59db6ab97f3b69ce7dca83e1337))
* **ui:** fold the archive's projects and act on them in bulk ([49c9ca8](https://github.com/dreadster3/pi-web/commit/49c9ca84b55b1f9951129337054f3afa0852a9d8))
* **ui:** more themes, picked by swatch ([#1269](https://github.com/dreadster3/pi-web/issues/1269)) ([d749fad](https://github.com/dreadster3/pi-web/commit/d749fadfaf5f9140f12fb42a7d83c2ba07f6920c))
* **ui:** show each agent's time, tokens and cost in the agent switcher ([972b02d](https://github.com/dreadster3/pi-web/commit/972b02ddc0a576ad7aab8c9074685266061445a8))
* **ui:** simplify the process fold summary and the project menu ([56f71d9](https://github.com/dreadster3/pi-web/commit/56f71d993f26b5ec43b054471a6a31a301d1f7e8))
* **ui:** toggle a subagent's side-panel tab from the agent switcher ([4b529b4](https://github.com/dreadster3/pi-web/commit/4b529b4d492a3b5441dc82899a16f2ce03f39c3c))


### Bug Fixes

* **chat:** a run's messages keep their scroll and open state when the file is read ([#1184](https://github.com/dreadster3/pi-web/issues/1184)) ([0c67f55](https://github.com/dreadster3/pi-web/commit/0c67f5562d3a615971be1209a5a256e720ac5c0a))
* **file-viewer:** keep the line-number gutter pinned and ease the code font ([#1200](https://github.com/dreadster3/pi-web/issues/1200)) ([c713fca](https://github.com/dreadster3/pi-web/commit/c713fcaaffd8044e7c88d6dbcfb7aa59680d6cc6))
* **files:** find a changed file's own repository for its diff ([#1236](https://github.com/dreadster3/pi-web/issues/1236)) ([ac54e01](https://github.com/dreadster3/pi-web/commit/ac54e0153277d09a38ec1ef116a9f1f1c788765c))
* **files:** stop overflowing panel tabs from being clipped ([#1225](https://github.com/dreadster3/pi-web/issues/1225)) ([#1242](https://github.com/dreadster3/pi-web/issues/1242)) ([bf0730c](https://github.com/dreadster3/pi-web/commit/bf0730c1548ae8e1c5aee2db3e47f14beeef10fd))
* guard the sound and thinking preferences against blocked localStorage ([49678aa](https://github.com/dreadster3/pi-web/commit/49678aac77fb6950ab3e1701b09d81594d238667))
* **http:** give connect attempts the CLI's two-second window ([#1261](https://github.com/dreadster3/pi-web/issues/1261)) ([8b9a084](https://github.com/dreadster3/pi-web/commit/8b9a084e523e8c3f73e0424a8c11265f7ea8f0e9))
* **http:** keep proxied HTTP origins on CONNECT tunnels so httpIdleTimeoutMs applies ([7504578](https://github.com/dreadster3/pi-web/commit/75045783bd92a31ea5f6e76d4712f49f750badc5))
* **models:** start a new session on a deferred default model ([#1240](https://github.com/dreadster3/pi-web/issues/1240)) ([#1262](https://github.com/dreadster3/pi-web/issues/1262)) ([eb135e5](https://github.com/dreadster3/pi-web/commit/eb135e5e260eb925dffdc46b81597de44a2a71ab))
* **sessions:** show a session name an extension sets after its run ([#1237](https://github.com/dreadster3/pi-web/issues/1237)) ([#1246](https://github.com/dreadster3/pi-web/issues/1246)) ([9cfe265](https://github.com/dreadster3/pi-web/commit/9cfe2656c483ca425888a62624b51cf781b69237))
* **skills:** open relative Markdown references in the detail pane ([#1234](https://github.com/dreadster3/pi-web/issues/1234)) ([f17a73a](https://github.com/dreadster3/pi-web/commit/f17a73abcd1421fc474112f8d0e0ba63fc40a680))
* **subagents:** keep a settled run findable by the id it was given ([#1198](https://github.com/dreadster3/pi-web/issues/1198)) ([c5555cd](https://github.com/dreadster3/pi-web/commit/c5555cd82b4ceb77f1f36f888ce1de019116422b))
* **subagents:** refuse resume in a removed worktree, and tell the parent where the worktree went ([#1202](https://github.com/dreadster3/pi-web/issues/1202)) ([32aa9f5](https://github.com/dreadster3/pi-web/commit/32aa9f58432b8ea6c535314db50f517b69a31ef6))
* **subagents:** size input_files by the child model's context window ([#1199](https://github.com/dreadster3/pi-web/issues/1199)) ([27d4e4d](https://github.com/dreadster3/pi-web/commit/27d4e4d1c76cfa5497c0f819a25e3193e3d524d2))
* **themes:** re-add latte and mocha themes ([50bf55c](https://github.com/dreadster3/pi-web/commit/50bf55c34c700091c2abe9605605a17f6b7af709))
* **tools:** keep bash off when defaultTools leaves it out ([#1235](https://github.com/dreadster3/pi-web/issues/1235)) ([#1245](https://github.com/dreadster3/pi-web/issues/1245)) ([b8ef31e](https://github.com/dreadster3/pi-web/commit/b8ef31e66fd14635e32b0e4ec443c7301ca4c6cc))
* **worktree:** focus the branch field when the create form swaps in over a filtered list ([#1203](https://github.com/dreadster3/pi-web/issues/1203)) ([84aa8d7](https://github.com/dreadster3/pi-web/commit/84aa8d73c3d128127fc82df187e858f1052a1c05))


### Performance Improvements

* **chat:** render long expanded thinking in pieces ([#1196](https://github.com/dreadster3/pi-web/issues/1196)) ([1037e0e](https://github.com/dreadster3/pi-web/commit/1037e0e8465501981f43fbbca4b0ac79b41146d1))
* **sessions:** omit provider signatures from browser payloads ([#1193](https://github.com/dreadster3/pi-web/issues/1193)) ([8f3a71e](https://github.com/dreadster3/pi-web/commit/8f3a71e01a960107b6228bb9f1ac27b6eb033554))
* **sessions:** rescan only the appended tail of a growing session file ([#1259](https://github.com/dreadster3/pi-web/issues/1259)) ([#1264](https://github.com/dreadster3/pi-web/issues/1264)) ([1a94341](https://github.com/dreadster3/pi-web/commit/1a94341cb2bdc9e152717f8514ccbc79171672f6))
* **settings:** stop reloading every extension per provider and skills request ([#1226](https://github.com/dreadster3/pi-web/issues/1226)) ([b7fb403](https://github.com/dreadster3/pi-web/commit/b7fb40327c1c0bac8c946384e189f0109b595b6c))

## [0.4.0](https://github.com/dreadster3/pi-web/compare/v0.3.0...v0.4.0) (2026-10-14)


### Miscellaneous Chores

* sync upstream ([b80e9cf](https://github.com/dreadster3/pi-web/commit/b80e9cf392b94f3e07d3c8884677388d9ac6978c))

## [0.3.0](https://github.com/dreadster3/pi-web/compare/v0.2.0...v0.3.0) (2026-10-11)


### Features

* **cli:** add version, update, status, stop and open commands ([#1139](https://github.com/dreadster3/pi-web/issues/1139)) ([#1154](https://github.com/dreadster3/pi-web/issues/1154)) ([f98c088](https://github.com/dreadster3/pi-web/commit/f98c088165582c11b6a9907b875ed7a54766aafd))
* **files:** preview HTML files larger than one 256 KB chunk ([#1155](https://github.com/dreadster3/pi-web/issues/1155)) ([93b3aba](https://github.com/dreadster3/pi-web/commit/93b3aba53d3c2fb4b4cf931fb898c55a94c3f808))
* **new-session:** brand above, project and worktree right over the composer ([e2fe4fb](https://github.com/dreadster3/pi-web/commit/e2fe4fb84264caeec799ea8f4d15fd2e9bde3793))
* **sessions:** open sidebar sessions in a new browser tab ([#1169](https://github.com/dreadster3/pi-web/issues/1169)) ([d9adb38](https://github.com/dreadster3/pi-web/commit/d9adb38627fa3191fbbad2956942cc783947d480))
* **sidebar:** delete all sessions of a project from its menu ([#1182](https://github.com/dreadster3/pi-web/issues/1182)) ([c8182b1](https://github.com/dreadster3/pi-web/commit/c8182b1835ac88f535d5cf31d94d0f8431cdf4cb))
* **sidebar:** files below the sessions on desktop, section-style project headers ([3fe257f](https://github.com/dreadster3/pi-web/commit/3fe257f231a893e4d046ac187e8cb7f237afee5e))
* **sidebar:** folding a group drops its "show more" window ([0066d5f](https://github.com/dreadster3/pi-web/commit/0066d5f98f2df890738fcf1b43d81c188b073386))
* **skills:** render full instructions in settings ([#1158](https://github.com/dreadster3/pi-web/issues/1158)) ([ae34240](https://github.com/dreadster3/pi-web/commit/ae34240e6673c3d817fee444223a78f5e4a16e2b))
* **subagents:** connect mcp.json servers with a profile's mcp: on ([#1053](https://github.com/dreadster3/pi-web/issues/1053)) ([#1187](https://github.com/dreadster3/pi-web/issues/1187)) ([68f04ef](https://github.com/dreadster3/pi-web/commit/68f04ef3c931da1ffefb529fa2a61b282e31df3e))
* **subagents:** read pi's model:level suffix for a run's thinking ([#1188](https://github.com/dreadster3/pi-web/issues/1188)) ([#1189](https://github.com/dreadster3/pi-web/issues/1189)) ([445b58c](https://github.com/dreadster3/pi-web/commit/445b58cd5200fe3f07c056a3f7d0449d1ec03ba8))
* **terminal:** add Termux-style extra keys on portrait touch screens ([#1166](https://github.com/dreadster3/pi-web/issues/1166)) ([6835326](https://github.com/dreadster3/pi-web/commit/6835326558cc17d298d514c7904656e6e65ceb6c))


### Bug Fixes

* **audio:** keep the chime's context running during a run ([#1157](https://github.com/dreadster3/pi-web/issues/1157)) ([#1185](https://github.com/dreadster3/pi-web/issues/1185)) ([d1529d0](https://github.com/dreadster3/pi-web/commit/d1529d04ce5daf2c9d2fb04f70535c693231a833))
* **audio:** suspend the completion-sound context while idle ([#1157](https://github.com/dreadster3/pi-web/issues/1157)) ([#1178](https://github.com/dreadster3/pi-web/issues/1178)) ([7a416ce](https://github.com/dreadster3/pi-web/commit/7a416ce8347513a03a40dae4e151d5841dbb81ce))
* **cli:** exit when the event loop drains after the server probe ([#1174](https://github.com/dreadster3/pi-web/issues/1174)) ([#1179](https://github.com/dreadster3/pi-web/issues/1179)) ([5abdee3](https://github.com/dreadster3/pi-web/commit/5abdee35e5fbe1248197e46a6ed60498968cbb06))
* **mcp:** say each fact once in a server's detail pane ([#1190](https://github.com/dreadster3/pi-web/issues/1190)) ([e8b0236](https://github.com/dreadster3/pi-web/commit/e8b0236bac1da4aedf43005c42ab2ba522610b94))
* **sessions:** a link to a gone session shows no other session ([#1168](https://github.com/dreadster3/pi-web/issues/1168)) ([#1180](https://github.com/dreadster3/pi-web/issues/1180)) ([e83280e](https://github.com/dreadster3/pi-web/commit/e83280ed32d01f92386dae477b6d05ff1ae0ec09))
* **sessions:** classify nested subagent children by layout ([#77](https://github.com/dreadster3/pi-web/issues/77)) ([c21ec05](https://github.com/dreadster3/pi-web/commit/c21ec05a2bd0020037586d3bac24288ac1fcb7d2))
* **sessions:** guard the remaining in-flight-turn invalidation paths ([#1173](https://github.com/dreadster3/pi-web/issues/1173)) ([e493310](https://github.com/dreadster3/pi-web/commit/e493310202bf9672081c8ba228b1a198131321d1))
* **sidebar:** selecting a revealed session no longer shows an older one ([51dda7c](https://github.com/dreadster3/pi-web/commit/51dda7c50402c30db484d0a4e78eb0ac675fb0a8))
* **sync:** drop the demo mirror file that re-entered the merge ([031537d](https://github.com/dreadster3/pi-web/commit/031537d6eb95018e262c8c529243b290c166128c))
* **terminal:** keep input alive when the phone keyboard collapses the panel ([#1160](https://github.com/dreadster3/pi-web/issues/1160)) ([3ff7e1d](https://github.com/dreadster3/pi-web/commit/3ff7e1d707c694bf7bbd9bcbc79331190e2f0061))


### Performance Improvements

* **chat:** load Prism languages on demand ([#1183](https://github.com/dreadster3/pi-web/issues/1183)) ([046bc67](https://github.com/dreadster3/pi-web/commit/046bc67ebbc9eadc3ff5d36fcea9f479ee920edc))
* **chat:** re-render only the streaming reply per chunk ([#1191](https://github.com/dreadster3/pi-web/issues/1191)) ([e8d91ef](https://github.com/dreadster3/pi-web/commit/e8d91efdcedf2a37a2ca0a31c2a6df9c30a4eb93))
* image caching, subagent relation cache, view-cache sizing, deferred code highlighting ([#1181](https://github.com/dreadster3/pi-web/issues/1181)) ([b2b6a45](https://github.com/dreadster3/pi-web/commit/b2b6a45b8f7e8f745b5016e18380c5f58b2ccdf0))
* **sessions:** rebuild the list once per finished run ([#1177](https://github.com/dreadster3/pi-web/issues/1177)) ([b73fdeb](https://github.com/dreadster3/pi-web/commit/b73fdebc683be46daa2b0275af4684d130b46f02))
* streaming markdown, session list payload, push title, SSE image echo ([#1176](https://github.com/dreadster3/pi-web/issues/1176)) ([a952ed5](https://github.com/dreadster3/pi-web/commit/a952ed507ea548df5536ac35a0e8eae8addf50d9))

## [0.2.0](https://github.com/dreadster3/pi-web/compare/v0.1.0...v0.2.0) (2026-10-09)


### Features

* **chat:** drop files onto the chat to upload them and mention them ([#1094](https://github.com/dreadster3/pi-web/issues/1094)) ([c3c5c6f](https://github.com/dreadster3/pi-web/commit/c3c5c6fbeec1cc486a9f05e7ef27b71b9bd05d6d))
* **chat:** pick the project and worktree above the new-session composer ([bb51aca](https://github.com/dreadster3/pi-web/commit/bb51acad978ef8d171834e387bc6f0d0b9e07a53))
* **chat:** put the new-session project bar on the brand's row ([12cf745](https://github.com/dreadster3/pi-web/commit/12cf745acb08c441f46bfb46c60ac84adf1aab84))
* **chat:** show extension command buttons in the status bar ([#1030](https://github.com/dreadster3/pi-web/issues/1030)) ([1333c80](https://github.com/dreadster3/pi-web/commit/1333c808b0fdebfe8a7b791ccea4658325d502cd))
* **files:** explorer switch to show Git-ignored files, dimmed with the reason ([#1092](https://github.com/dreadster3/pi-web/issues/1092)) ([2f6a0a9](https://github.com/dreadster3/pi-web/commit/2f6a0a93f7f8cef809729ea677bf4325244c8c3e))
* **projects:** delete a project's sessions ([#27](https://github.com/dreadster3/pi-web/issues/27)) ([0c03988](https://github.com/dreadster3/pi-web/commit/0c03988a1859c5d45bbc2101887852940f7ccb14))
* **settings:** support custom font families and weights ([#1074](https://github.com/dreadster3/pi-web/issues/1074)) ([86d94e2](https://github.com/dreadster3/pi-web/commit/86d94e2229f3d552a5b06ff7f79f9e4d09822937))
* **sidebar:** fork a session from its row menu ([085fba9](https://github.com/dreadster3/pi-web/commit/085fba902127b8f09ccda79b4a170488af1de0c9))
* **sidebar:** keep the files tab's buttons in view, in the project card ([4f883eb](https://github.com/dreadster3/pi-web/commit/4f883ebbab0a5219635acafe7f3ab96e6b99c95c))
* **sidebar:** keep the project order fixed and reorder projects by hand ([02ded7e](https://github.com/dreadster3/pi-web/commit/02ded7ef78663585c433c129f38a3f8eddd2de1a))
* **sidebar:** name a fork after its source with a short random suffix ([1aef2f6](https://github.com/dreadster3/pi-web/commit/1aef2f69d1d5a0cdfe96d68f7eb62270002f1c5a))
* **sidebar:** one toolbar row for the sidebar, main's project and worktree boxes ([5042bec](https://github.com/dreadster3/pi-web/commit/5042becbe48a4b3379e2a1b0347ada0b55f5dbb9))
* **sidebar:** page "show more" by 20 and restyle session rows ([fb34df9](https://github.com/dreadster3/pi-web/commit/fb34df94e97919ec73a6bdcfb85e81bffda1a1db))
* **sidebar:** project groups, pins and archive with a Sessions | Files split ([2e87ddb](https://github.com/dreadster3/pi-web/commit/2e87ddb1bf50412b6bacaac845ddeada204ac920))
* **sidebar:** search the files from the header's search button ([8e6b7d3](https://github.com/dreadster3/pi-web/commit/8e6b7d36776d76351bf8d458685503788f53ff14))
* **subagents:** live tail open subagent chats ([#68](https://github.com/dreadster3/pi-web/issues/68)) ([9fb7523](https://github.com/dreadster3/pi-web/commit/9fb7523b828908ca1a019a09101ba3911bcef838))
* **subagents:** load only the extensions a profile's extensions: list names ([#1091](https://github.com/dreadster3/pi-web/issues/1091)) ([17bbadb](https://github.com/dreadster3/pi-web/commit/17bbadb428227098b2281574b14457f49c4752de))
* **subagents:** preload named skills from profiles ([#1034](https://github.com/dreadster3/pi-web/issues/1034)) ([5d5a69e](https://github.com/dreadster3/pi-web/commit/5d5a69e488f4c81efc9635a429d4c067d89c22dd))
* **subagents:** steer and pause runs from chat ([#66](https://github.com/dreadster3/pi-web/issues/66)) ([58b09fb](https://github.com/dreadster3/pi-web/commit/58b09fb3e3d2623902693acc4c6aa4198696fa6c))


### Bug Fixes

* **chat:** let extension dialogs and the custom panel be widened ([#947](https://github.com/dreadster3/pi-web/issues/947)) ([#1032](https://github.com/dreadster3/pi-web/issues/1032)) ([981e270](https://github.com/dreadster3/pi-web/commit/981e270f1c4ab236d35cccf3a28a5312edfe6883))
* **chat:** make file mentions undoable ([#1098](https://github.com/dreadster3/pi-web/issues/1098)) ([012e805](https://github.com/dreadster3/pi-web/commit/012e805c62231b7699b3b7bfa9dac415b767b8fc))
* **chat:** refresh context usage between model calls ([#1058](https://github.com/dreadster3/pi-web/issues/1058)) ([9182fdf](https://github.com/dreadster3/pi-web/commit/9182fdfa160d8a5aa1cf49589abc9eada66a00d0))
* **deps:** repair incomplete bundled-dep entries in demo/package-lock.json ([#65](https://github.com/dreadster3/pi-web/issues/65)) ([cfbe6b9](https://github.com/dreadster3/pi-web/commit/cfbe6b96ca304a732e1af025f9757c2d8a1b3be2))
* **file-viewer:** keep the source view background across theme switches ([9da54e1](https://github.com/dreadster3/pi-web/commit/9da54e1213b6e2ada55129e029099d9ed7d91f9d))
* **markdown:** preserve code backgrounds across theme changes ([#1060](https://github.com/dreadster3/pi-web/issues/1060)) ([e2ea7da](https://github.com/dreadster3/pi-web/commit/e2ea7da3fd38e71fdb8d8e463ce6a7fc15c8df35))
* **markdown:** render emphasis next to CJK punctuation ([#1072](https://github.com/dreadster3/pi-web/issues/1072)) ([6d4d6b5](https://github.com/dreadster3/pi-web/commit/6d4d6b5b8e54e62475adb6cce3c44f259a1014c1))
* **markdown:** wrap long table cells without squeezing wide tables ([#1056](https://github.com/dreadster3/pi-web/issues/1056)) ([81e5b03](https://github.com/dreadster3/pi-web/commit/81e5b0393e86e77259eabe0a431e885371b1af12))
* **models:** list providers that extensions register at session_start ([#1071](https://github.com/dreadster3/pi-web/issues/1071)) ([a136267](https://github.com/dreadster3/pi-web/commit/a13626794eeaefeefca095635320aeaeacda46c5))
* **models:** preserve the catalog API protocol for models-only providers ([#1050](https://github.com/dreadster3/pi-web/issues/1050)) ([7aaeff9](https://github.com/dreadster3/pi-web/commit/7aaeff97f8ee33c9b2239ec3f5f3e3ae16f0a39a))
* preserve failed uploads and authorize git diff targets ([#1039](https://github.com/dreadster3/pi-web/issues/1039)) ([1ddaf11](https://github.com/dreadster3/pi-web/commit/1ddaf11f96e43bef174474880863038ce5fb7d33))
* **security:** rotate preview-mode secrets at startup to close proxy auth bypass ([cf3ebfb](https://github.com/dreadster3/pi-web/commit/cf3ebfba58b13ebfdc4bb6c8055788e7207266b7))
* **sessions:** don't force-navigate to an empty chat when the deleted session was already left ([#1083](https://github.com/dreadster3/pi-web/issues/1083)) ([a096af3](https://github.com/dreadster3/pi-web/commit/a096af3d09f4dd7eb8685b280f72d97d3ec6e0e5))
* **settings:** scroll the general page across the dialog's full width ([f722a5d](https://github.com/dreadster3/pi-web/commit/f722a5d8034203b276ed36684589ae72b7f87902))
* **shell:** restore desktop sidebar state after mobile resizing ([#1059](https://github.com/dreadster3/pi-web/issues/1059)) ([fdeea87](https://github.com/dreadster3/pi-web/commit/fdeea87329a291fcebcd54ba41fd2dd0387bfca7))
* **sidebar:** keep the drag ghost clear of the drop line ([ce5c08c](https://github.com/dreadster3/pi-web/commit/ce5c08c35bd20fad83692f8b571675bc36d79c7c))
* **subagents:** keep turn limits and terminal outcomes at the SDK boundary ([#1093](https://github.com/dreadster3/pi-web/issues/1093)) ([496611c](https://github.com/dreadster3/pi-web/commit/496611cbc1bdec70a44be0d750b8f6528e00bc03))
* **subagents:** reject unsupported resume option overrides ([f272cd8](https://github.com/dreadster3/pi-web/commit/f272cd85d99c209dce4da892ed48c5025d6014ef))
* **subagents:** reject unsupported resume option overrides ([6f2b4f0](https://github.com/dreadster3/pi-web/commit/6f2b4f0df46345b7c41f7b221324ae677ab2ca53))
* **subagents:** stop 4s notify replays in child chats ([#73](https://github.com/dreadster3/pi-web/issues/73)) ([24e0214](https://github.com/dreadster3/pi-web/commit/24e02149382958f77fc5d9db499181d4d8c3009a))
* **sw:** don't hold static responses behind the cache write ([#1089](https://github.com/dreadster3/pi-web/issues/1089)) ([37d4045](https://github.com/dreadster3/pi-web/commit/37d40453da4055dfbdfea82694b50d5044b610b7))


### Performance Improvements

* **sidebar:** replace SMIL spinner with compositor-friendly CSS animations ([#1042](https://github.com/dreadster3/pi-web/issues/1042)) ([80cd55e](https://github.com/dreadster3/pi-web/commit/80cd55ecc6bc5115b5968456eb22e4cc1765b463))

## [0.1.0](https://github.com/dreadster3/pi-web/compare/v0.0.4...v0.1.0) (2026-10-03)


### Features

* **chat:** fork a session while it is running ([#1023](https://github.com/dreadster3/pi-web/issues/1023)) ([19774b8](https://github.com/dreadster3/pi-web/commit/19774b8440abdd45694f47f2d4e9d56067dd9b43))
* **chat:** label MCP calls server/tool and indent their JSON results ([cc697e6](https://github.com/dreadster3/pi-web/commit/cc697e62e6029b94204683c884e7a7c0171cf43d))
* **chat:** open Settings › MCP from /mcp ([ce615e7](https://github.com/dreadster3/pi-web/commit/ce615e7c7f2f6760b368764f6cc74711cf0eef3b))
* **chat:** show a codemode call as its script and the tool calls it made ([9dc822e](https://github.com/dreadster3/pi-web/commit/9dc822e287fa0d3e67bb66bdcd944937e3715a09))
* **chat:** show a codemode script in the box any tool's input uses ([82e5539](https://github.com/dreadster3/pi-web/commit/82e553988814a96f828d57aab135380d09b25e92))
* **context:** delete any of the seven context files ([#23](https://github.com/dreadster3/pi-web/issues/23)) ([9afea64](https://github.com/dreadster3/pi-web/commit/9afea64e2a757c6a8e9a930a97c9a3d22ed8d081))
* **mcp:** add a server by pasting it, and trust a fresh folder in the same step ([eeda862](https://github.com/dreadster3/pi-web/commit/eeda86244d76043a7439b0cafe5f617ab1a80423))
* **mcp:** block MCP tools without readOnlyHint in read-only sessions ([e299ab9](https://github.com/dreadster3/pi-web/commit/e299ab9c6fe7cb8d26cdba27ad8c309f9ab82043))
* **mcp:** choose each server's exposure in Settings ([d702bc6](https://github.com/dreadster3/pi-web/commit/d702bc6f98d66f64da5dc34bf0ebce71a54db0da))
* **mcp:** choose in Settings whether Code mode takes over the built-in tools ([0b2d4fa](https://github.com/dreadster3/pi-web/commit/0b2d4fa9375bd45fc852a80efd7aaaa80bf5e33b))
* **mcp:** connect mcp.json servers through a per-session MCP host ([30fe218](https://github.com/dreadster3/pi-web/commit/30fe21852919dde2ca075674424fde282ebbc631))
* **mcp:** link github.com/mcp from the add pane again ([e851b03](https://github.com/dreadster3/pi-web/commit/e851b03ef11290f0a4ecd92fc0f81f8b6e0ca1cc))
* **mcp:** link the add pane to four MCP server catalogs ([dba11f4](https://github.com/dreadster3/pi-web/commit/dba11f471a6f72d3331a7845c6755440544d48c4))
* **mcp:** list every paste format the add pane reads, each with an example ([c8fc3c0](https://github.com/dreadster3/pi-web/commit/c8fc3c0a9e9af5b5c78711c51f085675b02c6964))
* **mcp:** list MCP servers from files only ([26e409e](https://github.com/dreadster3/pi-web/commit/26e409edce145a3e5d5fa4d166aabb49e175ee14))
* **mcp:** load the codemode, tool-search and mcp built-ins in normal sessions ([ba044f9](https://github.com/dreadster3/pi-web/commit/ba044f9894762890c94bd4dd01b9732ece4cade8))
* **mcp:** load the SDK's unexported MCP modules and scrub stdio environments ([85f9cb1](https://github.com/dreadster3/pi-web/commit/85f9cb1e98ce3aeba7724db2838bbb3111ea84ae))
* **mcp:** parse pasted MCP server configs ([2ac2a0f](https://github.com/dreadster3/pi-web/commit/2ac2a0f3ac34a1ab832ba0ebef765eaf4fcb2d20))
* **mcp:** report session connection state to Settings ([dff71a0](https://github.com/dreadster3/pi-web/commit/dff71a07f3af3f45a5b2b4a1b67d8a36e327350b))
* **mcp:** set Code mode's tool list budget in Settings ([6c599e9](https://github.com/dreadster3/pi-web/commit/6c599e971f1afe91cd519c4377d2318d3187f03e))
* **mcp:** sign in to and out of OAuth servers from Settings ([922a9d7](https://github.com/dreadster3/pi-web/commit/922a9d7386e20fbf1a089f738f9593dcbabd4ee5))
* **mcp:** switch, remove and undo MCP servers from Settings ([00647b0](https://github.com/dreadster3/pi-web/commit/00647b01d24af2ed5365344d7656d5a8c0b905f9))
* **mcp:** test a server's connection from Settings ([6695979](https://github.com/dreadster3/pi-web/commit/6695979e490d48162a0eb063de12b0e3850c24c6))
* **settings:** add Context tab for editing agent context files ([#21](https://github.com/dreadster3/pi-web/issues/21)) ([c365925](https://github.com/dreadster3/pi-web/commit/c365925001982f19792e0ebf3d919014a7176d67))
* **settings:** choose Code mode Automatic or Always on in Settings › MCP ([9cf9547](https://github.com/dreadster3/pi-web/commit/9cf95474d5d46edd56f97cd8b711b9d386f19d72))
* **settings:** choose global or project in one place in every add pane ([3eb8a9d](https://github.com/dreadster3/pi-web/commit/3eb8a9d9a59bcb38b176afd8480838222623f4aa))
* **settings:** list MCP servers read-only in Settings › MCP ([8716e70](https://github.com/dreadster3/pi-web/commit/8716e70824d183c8585e277ee9a3d3773e430d36))
* **settings:** trust a project from Settings › MCP ([92489b7](https://github.com/dreadster3/pi-web/commit/92489b77da1de0d3514b03f8f06094c0906efd18))
* **tools:** write the Code mode choice through /api/tools/settings ([1c387b4](https://github.com/dreadster3/pi-web/commit/1c387b473b67decfa6c74c4302ce58100f6f1ac8))
* **trust:** list a project's MCP servers in the trust dialog ([3e693c7](https://github.com/dreadster3/pi-web/commit/3e693c7b3b0fa80d565a0ac0b8feed911c440ac8))


### Bug Fixes

* **agents:** split a jammed line after conflict merge ([7b965bd](https://github.com/dreadster3/pi-web/commit/7b965bdf37f7a9202fbec1d5ba6807a29938d8d2))
* **chat:** drop extension UI requests the server closed while the stream was down ([e17d2cc](https://github.com/dreadster3/pi-web/commit/e17d2cc71983c8dad7ca4e98461d095cd7890df3))
* **chat:** drop the light theme's own border inside code blocks ([cfcf2a1](https://github.com/dreadster3/pi-web/commit/cfcf2a1a1e7259b91921bb841b3fabb04020823d))
* **chat:** label MCP calls server/tool only from their result's details ([a87758e](https://github.com/dreadster3/pi-web/commit/a87758e09ab34f90dfaaceb7efa07e18f9028e80))
* **chat:** preserve drafts when selecting history edits ([94c1f5c](https://github.com/dreadster3/pi-web/commit/94c1f5c321d717a185be807942edde9ba1328ddd))
* **chat:** queue extension dialogs and custom panels by request id ([70470ca](https://github.com/dreadster3/pi-web/commit/70470cab784c3bcba6496453f6eceb04df151ed1))
* **deps:** bump the earendil SDK to 1.0.1; build nix deps from importNpmLock ([#24](https://github.com/dreadster3/pi-web/issues/24)) ([dd0a766](https://github.com/dreadster3/pi-web/commit/dd0a766c5dcb86484db2cee114ba9da7553c78d3))
* **files:** stop authorizing paths from system messages and non-coding tool results ([b3c7255](https://github.com/dreadster3/pi-web/commit/b3c7255d31895f6c90da0b9d84094a7553c834fc))
* **mcp:** ask for the server's name right after the paste ([b183176](https://github.com/dreadster3/pi-web/commit/b183176c9c97786d8c2088d588c650910d6d3fc4))
* **mcp:** bar a Test's token writes after Sign out, and free the host first ([bf9decc](https://github.com/dreadster3/pi-web/commit/bf9deccc69322319dbc72746b363a44e9910c9ab))
* **mcp:** connect a trusted project's servers as the pi CLI does ([d733d43](https://github.com/dreadster3/pi-web/commit/d733d4346ac52cf96fa5aad69c5e8f0237bd4a4e))
* **mcp:** idle out servers registered for a prompt that starts no run ([3dc123b](https://github.com/dreadster3/pi-web/commit/3dc123b33d2b81be8b207923e20d5d9c910623fd))
* **mcp:** keep a hostile .pi/mcp.json from stopping the host or Settings ([2ef137c](https://github.com/dreadster3/pi-web/commit/2ef137cea21fde149619a4d5fad63e65d60d9df8))
* **mcp:** label the official registry link MCP Registry ([4e1edd8](https://github.com/dreadster3/pi-web/commit/4e1edd8513af72a229f20316471cab206f60f0df))
* **mcp:** open a variable box with a name, and keep the Added notice short ([570f355](https://github.com/dreadster3/pi-web/commit/570f35518f3d1b6acb63051ce3bd8d6584d84a16))
* **mcp:** read project trust fresh before every host sync ([d1283eb](https://github.com/dreadster3/pi-web/commit/d1283eb954f8d8960815a63c3e45c396fb47a685))
* **mcp:** say less in Settings › MCP, and move Test to the header ([0dee0f0](https://github.com/dreadster3/pi-web/commit/0dee0f00f38864730a00ee3a75a7a2824ee078e2))
* **mcp:** say what to type in Add's value boxes ([de91212](https://github.com/dreadster3/pi-web/commit/de91212762dd5af481af7728f895c56002c1abdf))
* **mcp:** shorten the Code mode pane and bold the chosen option ([9d5b077](https://github.com/dreadster3/pi-web/commit/9d5b0776eb5e50f9c4ea151d91329166d275b98a))
* **mcp:** show the command an install link or untrusted project runs ([207ce36](https://github.com/dreadster3/pi-web/commit/207ce361d8ae7f37218423fbafa72d8b030420be))
* **mcp:** skip the MCP wait for extension commands, and refuse late transports ([5d4c0b5](https://github.com/dreadster3/pi-web/commit/5d4c0b543a796a3951b8e53580aeb191fa538bc9))
* **mcp:** word Add's refusals, check every cwd alike, and say what is true ([d85555e](https://github.com/dreadster3/pi-web/commit/d85555e20eb8a6b6f10d639d3f257df6db16fe6c))
* **models:** say why a model switch cannot move in visible text ([8800b5a](https://github.com/dreadster3/pi-web/commit/8800b5a042509c436fe8dc86494239cb412830c2))
* **sessions:** treat a wrapper as gone once shutdown starts and bound session_shutdown ([aed0f3c](https://github.com/dreadster3/pi-web/commit/aed0f3ce51550a1311fd4d6fac4e66d0f2a17ab7))
* **sessions:** wait for a closing wrapper before reopening its session ([34c8fdf](https://github.com/dreadster3/pi-web/commit/34c8fdfdb91530aabe61a87acee82595b1676522))
* **settings:** enlarge skill and plugin group switches ([4de9f77](https://github.com/dreadster3/pi-web/commit/4de9f77e7af8633c856394e656c91e80ca2802f3))
* **settings:** keep Settings › MCP truthful and reachable around its edges ([cea11aa](https://github.com/dreadster3/pi-web/commit/cea11aabdfeec708c57881c2e576b2e0c057dc2b))
* **tools:** carry only active tools and keep session tools across navigation ([18758b7](https://github.com/dreadster3/pi-web/commit/18758b776a9676f90ebc354500a573b908ce3a8f))
* **tools:** list only declared tools in the Tools panel under Code mode's In scripts ([7b3df71](https://github.com/dreadster3/pi-web/commit/7b3df715afc5c65dec88eab44e4d2dbcc9712314))
* **tools:** show the tool descriptions the model is sent ([834b6b8](https://github.com/dreadster3/pi-web/commit/834b6b80793f3d76e0c9868b4157ba3065585c1d))
* **trust:** do not trust a fresh folder that holds an unseen project ([baaf825](https://github.com/dreadster3/pi-web/commit/baaf825aba91326c4eceb101309bae3a1626ce2b))
* **worktrees:** find the worktree to remove by its real path ([82d1f54](https://github.com/dreadster3/pi-web/commit/82d1f54861578aa697077142db7c5a9abfb28c0b))


### Performance Improvements

* **sse:** slim nested tool events and coalesce tool updates ([b8e0b71](https://github.com/dreadster3/pi-web/commit/b8e0b71c7a0b6b046cec4906a5a55c728935edc0))
