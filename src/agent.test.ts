import test from "node:test";
import assert from "node:assert/strict";
import {query} from "@anthropic-ai/claude-agent-sdk";
import {skillSelection,lessonOptions,validateConfig,toolAllowed,directories} from "./agent.js";
test("omission, all, an exact list and [] remain distinct",()=>{
 assert.equal(skillSelection("omitted"),undefined);assert.equal(skillSelection("all"),"all");
 assert.deepEqual(skillSelection("allow-one"),["catalog-summary"]);assert.deepEqual(skillSelection("none"),[]);
 assert.equal(Object.hasOwn(lessonOptions({mode:"omitted"},"test",[],[]),"skills"),false);
});
test("explicit tools include Skill while sources independently control discovery",()=>{
 const o=lessonOptions({mode:"no-source"},"test",[],[]);
 assert.deepEqual(o.settingSources,[]);assert.deepEqual(o.tools,["Read","Skill"]);assert.equal(o.skills,"all");
});
test("slash dispatch keeps the restricted model skill list",()=>{
 assert.deepEqual(lessonOptions({mode:"slash"},"test",[],[]).skills,["catalog-summary"]);
});
test("the SDK itself rejects a wildcard before creating the session",()=>{
 assert.throws(()=>query({prompt:"Hello",options:{skills:["*"]}}),/skill|wildcard/i);
});
test("host permits only classroom skill names and the owned data file",()=>{
 const cwd=directories({mode:"all"},"test").cwd;
 assert.ok(toolAllowed(cwd,"Skill",{skill:"catalog-summary"}));assert.ok(toolAllowed(cwd,"Read",{file_path:"catalog.md"}));
 assert.equal(toolAllowed(cwd,"Skill",{skill:"other"}),false);
 assert.equal(toolAllowed(cwd,"Read",{file_path:".claude/skills/catalog-summary/SKILL.md"}),false);
 assert.equal(toolAllowed(cwd,"Bash",{}),false);assert.throws(()=>validateConfig({mode:"../../"}));
});
