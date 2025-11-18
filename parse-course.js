#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read all course files
const courseFiles = [
    'полный_курс_sql_часть1.md',
    'полный_курс_sql_часть2.md',
    'полный_курс_sql_часть3.md',
    'полный_курс_sql_часть4.md',
    'полный_курс_sql_часть5.md',
    'полный_курс_sql_часть6.md',
    'полный_курс_sql_часть7.md',
    'полный_курс_sql_часть8.md',
    'полный_курс_sql_часть9.md'
];

const chapters = [];
let currentSection = '';
let currentChapterTitle = '';
let currentContent = '';

function saveChapter() {
    if (currentChapterTitle && currentContent) {
        chapters.push({
            section: currentSection,
            title: currentChapterTitle,
            content: currentContent.trim()
        });
    }
}

courseFiles.forEach((file, fileIndex) => {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, lineIndex) => {
        // Detect section headers
        if (line.startsWith('# ') && !line.startsWith('## ') && !line.startsWith('### ')) {
            saveChapter();
            currentSection = line.replace(/^# /, '').trim();
            currentChapterTitle = '';
            currentContent = '';
        }
        // Detect chapter headers
        else if (line.startsWith('## ') && !line.startsWith('### ')) {
            saveChapter();
            currentChapterTitle = line.replace(/^## /, '').trim();
            currentContent = '';
        }
        // Collect content for current chapter
        else if (currentChapterTitle) {
            currentContent += line + '\n';
        }
    });
});

// Save last chapter
saveChapter();

// Generate JavaScript file
const jsContent = `// Generated Course Data
const courseData = {
    chapters: ${JSON.stringify(chapters, null, 2)}
};`;

fs.writeFileSync('course-data.js', jsContent);
console.log(`✅ Successfully parsed ${chapters.length} chapters into course-data.js`);
