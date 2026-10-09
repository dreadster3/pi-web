# Changelog

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
