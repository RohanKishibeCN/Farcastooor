const content = "```\n{\"a\":1}\n```";
let c = content.trim();
if (c.startsWith('```json')) {
  c = c.replace(/```json\n?/, '').replace(/```/,'').trim();
}
console.log(JSON.parse(c));
