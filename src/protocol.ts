export type Mode="all"|"omitted"|"allow-one"|"none"|"no-source"|"slash"|"invalid";
export type RunConfig={mode:Mode};
export type LabEvent=
 | {type:"fixtures";files:{name:string;contents:string}[]}
 | {type:"options";config:RunConfig;options:Record<string,unknown>}
 | {type:"initialized";model:string;sessionId:string;skills:string[];tools:string[];slashCommands:string[]}
 | {type:"message";sdkType:string;summary:string}
 | {type:"tool";name:string;target:string}
 | {type:"answer";text:string}
 | {type:"result";status:string;text:string;sessionId:string;costUsd:number}
 | {type:"rejected";stage:string;text:string}
 | {type:"evidence";mode:Mode;initSkills:string[];readPaths:string[];skillCalls:string[];returnedMarkers:string[];sdkRejectedBeforeInit:boolean;savedFilesUnchanged:boolean;dispatchPrompt:boolean}
 | {type:"notice"|"error";text:string};
