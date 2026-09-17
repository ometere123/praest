import {existsSync, readdirSync, readFileSync, statSync, writeFileSync} from "node:fs";
import path from "node:path";
const root = process.cwd(); const failures = []; const warnings = []; const passes = [];
const required = ["README.md", "contracts/genlayer/PRAESTAgreementVault.py", "contracts/genlayer/PRAESTAdjudicator.py", "deployments/agent-tank.json", "skills/praest/SKILL.md"];
for (const f of required) (existsSync(path.join(root, f)) ? passes : failures).push(`${existsSync(path.join(root, f)) ? "present" : "missing"} ${f}`);
const files = [];
function walk(dir) { for (const e of readdirSync(dir)) { if (["node_modules", ".git", "dist", ".next", "__pycache__", ".pytest_cache", "out", "target"].includes(e)) continue; const p = path.join(dir, e); const s = statSync(p); if (s.isDirectory()) walk(p); else files.push(p); } }
walk(root);
for (const f of files) { if (f.endsWith("verify-repo.mjs") || !/\.(ts|tsx|js|mjs|py|json|md|ya?ml|toml)$/.test(f)) continue; const t = readFileSync(f, "utf8"); if (/py-genlayer:(?:test|latest)(?:"|\s|$)/.test(t)) failures.push(`unpinned runner ${f}`); if (/TODO:\s*implement|not implemented/i.test(t)) failures.push(`placeholder ${f}`); }
try { const {execFileSync} = await import("node:child_process"); const localPython = "C:\\Users\\USER\\AppData\\Local\\Python\\pythoncore-3.14-64\\python.exe"; const python = process.env.PRAEST_PYTHON || (process.platform === "win32" && existsSync(localPython) ? localPython : "python3"); execFileSync(python, ["-m", "py_compile", "contracts/genlayer/PRAESTAgreementVault.py", "contracts/genlayer/PRAESTAdjudicator.py"], {stdio: "pipe"}); passes.push("focused contract Python syntax"); } catch { failures.push("focused contract Python syntax failed"); }
const manifest = JSON.parse(readFileSync("deployments/agent-tank.json", "utf8")); if (manifest.chainId === 61997 && manifest.rpc === "https://studio-dev.genlayer.com/api") passes.push("Studio-dev manifest"); else failures.push("invalid Studio-dev manifest");
warnings.push("live deployment and dependency-resolved typecheck require network/runtime credentials");
const report = {generatedAt: new Date().toISOString(), passes, warnings, failures, fileCount: files.length}; writeFileSync("verification/static-report.json", JSON.stringify(report, null, 2));
for (const x of passes) console.log(`✓ ${x}`); for (const x of warnings) console.warn(`! ${x}`); for (const x of failures) console.error(`✗ ${x}`); if (failures.length) process.exit(1);
