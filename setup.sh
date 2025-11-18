#!/bin/bash

# SQL Academy Setup Script
# This script helps set up the interactive SQL course

echo "🎓 SQL Academy - Interactive Course Setup"
echo "=========================================="
echo ""

# Check if course-data.js exists
if [ ! -f "course-data.js" ]; then
    echo "📦 Generating course data from markdown files..."
    if command -v node &> /dev/null; then
        node parse-course.js
    else
        echo "⚠️  Node.js not found. Please run: node parse-course.js"
        exit 1
    fi
fi

echo "✅ Course data generated successfully!"
echo ""
echo "🚀 Interactive course is ready!"
echo ""
echo "To start learning, open one of the following:"
echo ""
echo "1. Direct file (simplest):"
echo "   - Open: index.html in your browser"
echo ""
echo "2. Local server (recommended):"
echo ""
echo "   Using Python 3:"
echo "   python -m http.server 8000"
echo ""
echo "   Using Python 2:"
echo "   python -m SimpleHTTPServer 8000"
echo ""
echo "   Using Node.js:"
echo "   npx http-server"
echo ""
echo "   Using PHP:"
echo "   php -S localhost:8000"
echo ""
echo "Then open: http://localhost:8000"
echo ""
echo "=========================================="
echo "📚 Features:"
echo "   ✓ 94 interactive chapters"
echo "   ✓ Progress tracking"
echo "   ✓ Bookmarks and statistics"
echo "   ✓ Dark/Light theme"
echo "   ✓ Certificate generation"
echo "   ✓ Keyboard shortcuts (Alt+→, Alt+←, etc.)"
echo ""
echo "📖 For more information, read: README_INTERACTIVE_COURSE.md"
echo ""
