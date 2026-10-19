// Patches the bundled yoshi389111/github-profile-3d-contrib action:
//  1. Any day with more than MAX_DAILY_CONTRIBUTIONS contributions is drawn as 0
//     and excluded from the totals.
//  2. The "rainbow" type can cycle through a custom palette (settings.rainbowColors)
//     instead of plain HSL hues; settings.rainbowMix sets how strongly each
//     contribution level (0-4) blends from backgroundColor toward the palette colour.
// Usage: node patch-action.js <path-to-action-checkout>
const fs = require('fs');
const path = require('path');

const distFile = path.join(process.argv[2], 'dist', 'index.js');
let src = fs.readFileSync(distFile, 'utf8');

const patch = (anchor, replacement) => {
    if (src.split(anchor).length !== 2) {
        console.error(`patch anchor not found exactly once: ${anchor}\naction version changed?`);
        process.exit(1);
    }
    src = src.replace(anchor, replacement);
};

// 1. cap daily contributions
patch(
    'const user = response.data.user;',
    `const user = response.data.user;
    (() => {
        const max = Number(process.env.MAX_DAILY_CONTRIBUTIONS);
        if (!max) return;
        const coll = user.contributionsCollection;
        let removed = 0;
        let days = 0;
        for (const week of coll.contributionCalendar.weeks) {
            for (const day of week.contributionDays) {
                if (day.contributionCount > max) {
                    removed += day.contributionCount;
                    days += 1;
                    day.contributionCount = 0;
                    day.contributionLevel = 'NONE';
                }
            }
        }
        coll.contributionCalendar.totalContributions = Math.max(0, coll.contributionCalendar.totalContributions - removed);
        coll.totalCommitContributions = Math.max(0, coll.totalCommitContributions - removed);
        console.log(\`[cap] zeroed \${days} day(s) with > \${max} contributions (\${removed} removed)\`);
    })();`,
);

// 2. custom rainbow palette
patch(
    "if (settings.type == 'rainbow') {\n        const hues",
    `if (settings.type == 'rainbow' && settings.rainbowColors) {
        const cols = [...settings.rainbowColors, settings.rainbowColors[0]];
        const faces = [['top', DARKER_TOP], ['left', DARKER_LEFT], ['right', DARKER_RIGHT]];
        settings.rainbowMix.forEach((mix, level) => {
            for (const [faceName, darker] of faces) {
                const className = \`rb-l\${level}-\${faceName}\`;
                cssColors.push(\`.\${className}{animation:\${className} \${settings.duration} linear infinite;}\`);
                const stops = cols
                    .map((c, i) => {
                        const pct = ((i / (cols.length - 1)) * 100).toFixed(2);
                        const fill = d3.rgb(d3.interpolateRgb(settings.backgroundColor, c)(mix)).darker(darker).toString();
                        return \`\${pct}%{fill:\${fill}}\`;
                    })
                    .join('');
                cssColors.push(\`@keyframes \${className}{\${stops}}\`);
            }
        });
    }
    else if (settings.type == 'rainbow') {
        const hues`,
);

fs.writeFileSync(distFile, src);
console.log(`patched ${distFile}`);
