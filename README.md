# Claude Agent SDK · Lesson 17 · Skills in the SDK

Based on Lesson17_Skills_in_the_SDK.pptx. Five linked web pages, large text, formatted answers and 13 source-linked UML steps.

## What you will learn

- Discover filesystem skills: A skill is a directory containing SKILL.md with a name, description and workflow instructions. The SDK discovers metadata from selected filesystem sources, rather than a programmatic skill-registration API.
- Load expertise on demand: The model invokes the Skill tool when an available description matches the task. Successful tool evidence and returned skill-specific markers demonstrate observed invocation; the app does not claim to capture every internal prompt block.
- Choose an invocation scope: Compare omitted skills, "all", an exact-name list and []. When tools is explicit, include Skill. Setting skills auto-adds Skill to allowedTools in the SDK, but explicit tools still governs availability.
- Read discovery metadata correctly: system/init.skills lists user-invocable skills, including bundled entries, and is not the skills allowlist. A restricted session can still list both classroom skills. user-invocable:false skills are a separate reference case, not created here.
- Separate direct dispatch from model invocation: Sending /api-review dispatches a user-invocable skill even when it is omitted from the model skills list. Restricting skills is not an OS/file permission boundary. The host separately restricts reads and commands.
- Troubleshoot with actual evidence: Check cwd and settingSources when skills are missing, description and scope when they are unused, and exact-name syntax when validation fails. The wildcard experiment exercises actual SDK validation before initialization.

## Configure and run

```powershell
git clone https://github.com/luiscoco/Udemy-Claude-Agent-SDK-lesson17-app.git
cd .\Udemy-Claude-Agent-SDK-lesson17-app
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
npm start
```

From presentations, use `cd .\agent-sdk\lesson17-skills` instead of cloning. Open http://127.0.0.1:3117 and keep the terminal running. Node.js 24+ and model access are required.

## Create your .env file

Preserve an existing file or copy .env.example. Enter your key locally; do not commit it. Restart after edits. Shell values take precedence over the optional file loaded by npm start.

```dotenv
ANTHROPIC_API_KEY=your_api_key
CLAUDE_MODEL=claude-sonnet-4-6
PORT=3117
# Windows if needed: CLAUDE_CODE_GIT_BASH_PATH=C:/Program Files/Git/bin/bash.exe
```

On Windows, set the Git Bash path if needed. Keep optional npm dependencies enabled. A second start recognizes this app; change PORT if another service occupies it.

## Run the experiments

1. Compare an exact list and an empty list: Run Allow one, then None. The init list can still contain both classroom names in the restricted session. The plain-summary case does not invoke a skill.
2. Break discovery and compare direct dispatch: Run No sources and confirm the classroom skills are absent. Then dispatch /api-review with a catalog-only model list and compare the actual response with Skill tool evidence.
3. Exercise real SDK name validation: Run Invalid wildcard. Expect an SDK validation rejection before system/init, not a fabricated model reply. Then inspect the two safe SKILL.md files and the code walkthrough.

```powershell
npm run sample:env -- all
npm run sample:env -- omitted
npm run sample:env -- allow-one
npm run sample:env -- slash
npm test
```

`sample` uses only the launching shell environment; `sample:env` loads the optional file. All queries are real and read-only. Prompt and context are fixed classroom choices, not arbitrary browser-supplied source paths.

## How the app was built

### 1. Validate the classroom experiment

Accept only fixed classroom modes. No arbitrary skill code, prompt, path or command can be submitted by the browser.

Source: `src/agent.ts`, lines 101–101. Selected excerpt.

```typescript
c=validateConfig(c);const id=randomUUID(),files=await prepareWorkspace(c,id);
```

### 2. Write real SKILL.md artifacts

The host writes two trusted skills as filesystem artifacts before starting the SDK. Full contents are not inserted into the task prompt.

Source: `src/agent.ts`, lines 57–57. Selected excerpt.

```typescript
for(const file of files)await writeFile(file.path,file.contents);
```

### 3. Choose omitted, all, a list or none

The factory preserves actual omission, enables all skills, selects one exact name, disables model invocation, or passes an invalid wildcard for the SDK to reject.

Source: `src/agent.ts`, lines 40–44. Selected excerpt.

```typescript
if(mode==="omitted")return undefined;
 if(mode==="allow-one" || mode==="slash")return ["catalog-summary"];
 if(mode==="none")return [];
 if(mode==="invalid")return ["*"];
 return "all";
```

### 4. Control filesystem discovery

Project source loads classroom skill metadata. The broken-source experiment uses [] while the actual files remain on disk.

Source: `src/agent.ts`, lines 72–72. Selected excerpt.

```typescript
settingSources:c.mode==="no-source" ? [] : ["project"],
```

### 5. Expose the Skill tool explicitly

When tools is explicit, Skill must be included. Invocation scope and general tool availability are separate configuration layers.

Source: `src/agent.ts`, lines 74–74. Selected excerpt.

```typescript
tools:["Read","Skill"],allowedTools:["Read","Skill"],
```

### 6. Guard model tool access

The host supports only the two classroom Skill names and exact catalog.md reads. Read cannot fetch SKILL.md; Bash, Write and Edit are unavailable.

Source: `src/agent.ts`, lines 62–64. Selected excerpt.

```typescript
if(name==="Skill")return ["catalog-summary","api-review"].includes(String(input.skill));
 return name==="Read" && typeof input.file_path==="string"
  && resolve(cwd,input.file_path).toLowerCase()===resolve(cwd,"catalog.md").toLowerCase();
```

### 7. Choose model workflow or slash dispatch

A normal prompt asks the model to invoke a matching available skill. The slash case deliberately uses /api-review, whose dispatch is independent of the model skills list.

Source: `src/agent.ts`, lines 108–108. Selected excerpt.

```typescript
const prompt=c.mode==="slash" ? PROMPTS.slash : ["none","no-source"].includes(c.mode) ? PROMPTS.plain : PROMPTS.summary;
```

### 8. Start the actual SDK query

The SDK discovers metadata, handles selected skill invocation and owns the model/tool loop. The wildcard mode exercises its real startup validator.

Source: `src/agent.ts`, lines 110–110. Selected excerpt.

```typescript
const run=query({prompt,options});
```

### 9. Preserve discovery metadata from init

The init array lists user-invocable skills and can include bundled entries. It is not the model allowlist, and does not prove invocation.

Source: `src/agent.ts`, lines 115–115. Selected excerpt.

```typescript
started=true;initSkills=message.skills;
```

### 10. Record completed Skill invocations

A completed Skill tool call is independent evidence of model invocation. Slash dispatch can load a skill without such a tool call.

Source: `src/agent.ts`, lines 89–89. Selected excerpt.

```typescript
if(input.tool_name==="Skill")skillCalls.push(String(v.skill));
```

### 11. Keep SDK validation errors factual

Only an actual SDK skill-name validation error before init becomes the rejected outcome. Other errors remain failures rather than being relabelled as a successful exercise.

Source: `src/agent.ts`, lines 130–132. Selected excerpt.

```typescript
if(c.mode!=="invalid" || started || !/skill|wildcard/i.test(String(error)))throw error;
  rejected=true;
  emit({type:"rejected",stage:"SDK option validation before init",text:redact(error instanceof Error ? error.message : String(error))});
```

### 12. Verify files and actual result markers

Compare saved skill hashes and extract markers from actual text. Marker compliance is an observation, not a complete internal prompt audit.

Source: `src/agent.ts`, lines 134–134. Selected excerpt.

```typescript
const savedFilesUnchanged=(await Promise.all(files.map(async(f,i)=>digest(await readFile(f.path,"utf8"))===before[i]))).every(Boolean);
```

### 13. Render the readable answer

Render real assistant Markdown through parsing and sanitization. Keep discovery, completed tools, scope and direct dispatch distinct in the page.

Source: `src/client.ts`, lines 20–20. Selected excerpt.

```typescript
if (e.type === "answer") renderMarkdown($("answer"), e.text);
```

## Reference topics and limits

- Progressive loading: Descriptions and names are discovered first; skill instructions load on invocation. The successful Skill call and skill marker demonstrate observed behavior here. The app does not log private raw requests to claim a complete token-level account of progressive disclosure.
- Discovery is not scope: system/init.skills lists user-invocable skills whether or not they are in the model skills list. user-invocable:false skills can load without appearing there; that frontmatter variant is explained, not authored in this lab.
- Exact names and plugins: Use exact directory names for these project skills. Plugin skills use plugin:skill names. Empty, padded, wildcard and certain punctuation-containing names are invalid. Plugins and additional-directory naming collisions are reference topics, not executed integrations.
- Commands are a separate invocation path: The model skills list hides unlisted skills from the model and restricts the Skill tool, but does not block dispatching a user-invocable skill through /name. It is not an OS/file-access boundary. This app blocks direct Read access to skill files and has no Bash tool.
- Troubleshooting: Missing: check cwd, selected sources and directory location. Unused: check scope and a precise description. Invalid name: use exact supported names or all. The no-source case and real wildcard rejection make two of these failure modes observable.
- Classroom boundaries: Only two harmless read-only skills are supported by the host guard. Private runtime/home/config paths and disabled auto memory make comparisons controlled; they are not production tenant isolation. Skill instructions remain model guidance rather than guaranteed enforcement.

The app never exposes the expanded internal prompt or inherited environment. Marker flags describe actual text, not complete instruction audits. Runtime skill files and private session context remain local. Private classroom directories are not an OS sandbox. Media, .env, dependencies and runtime files are excluded from Git.

## References

- [Skills in the SDK](https://code.claude.com/docs/en/agent-sdk/skills)
- [Official skill configuration guide](https://code.claude.com/docs/en/agent-sdk/skills)
- [TypeScript SDK reference](https://code.claude.com/docs/en/agent-sdk/typescript)

Regenerate student pages with `python scripts/build-pages.py`.
