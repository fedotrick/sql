// Course Management System
class CourseApp {
    constructor() {
        this.currentChapterIndex = 0;
        this.completedChapters = new Set();
        this.bookmarkedChapters = new Set();
        this.studentName = 'Студент SQL Academy';
        this.studyTimeSeconds = 0;
        this.streakDays = 0;
        this.lastStudyDate = null;
        
        this.init();
    }

    init() {
        this.loadProgress();
        this.setupEventListeners();
        this.renderNavigation();
        this.loadChapter(this.currentChapterIndex);
        this.applyTheme();
        this.startStudyTimer();
        this.updateStats();
    }

    setupEventListeners() {
        // Navigation
        document.getElementById('prevBtn').addEventListener('click', () => this.previousChapter());
        document.getElementById('nextBtn').addEventListener('click', () => this.nextChapter());

        // Sidebar toggle
        document.getElementById('menuToggle').addEventListener('click', () => this.toggleSidebar());

        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());

        // Chapter actions
        document.getElementById('markCompleteBtn').addEventListener('click', () => this.toggleChapterComplete());
        document.getElementById('bookmarkBtn').addEventListener('click', () => this.toggleBookmark());

        // Progress reset
        document.getElementById('resetProgressBtn').addEventListener('click', () => this.resetProgress());

        // Certificate
        document.getElementById('printCertBtn').addEventListener('click', () => this.showCertificate());

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Modal overlay
        document.getElementById('modalOverlay').addEventListener('click', (e) => {
            if (e.target === document.getElementById('modalOverlay')) {
                this.closeAllModals();
            }
        });

        // Modal close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.modal').classList.remove('active');
                document.getElementById('modalOverlay').classList.remove('active');
            });
        });

        // Search
        document.getElementById('searchInput').addEventListener('input', (e) => this.filterNavigation(e.target.value));

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
    }

    renderNavigation() {
        const navContent = document.getElementById('navContent');
        navContent.innerHTML = '';

        let currentSection = '';
        let currentSectionElement = null;

        courseData.chapters.forEach((chapter, index) => {
            if (chapter.section !== currentSection) {
                currentSection = chapter.section;
                const sectionEl = document.createElement('div');
                sectionEl.className = 'nav-section';
                
                const titleEl = document.createElement('div');
                titleEl.className = 'nav-section-title';
                titleEl.textContent = currentSection;
                sectionEl.appendChild(titleEl);
                
                currentSectionElement = document.createElement('ul');
                sectionEl.appendChild(currentSectionElement);
                navContent.appendChild(sectionEl);
            }

            const li = document.createElement('li');
            li.className = 'nav-item';

            const link = document.createElement('a');
            link.className = 'nav-link';
            link.dataset.index = index;
            link.textContent = chapter.title;

            if (this.completedChapters.has(index)) {
                link.classList.add('completed');
            }
            if (this.bookmarkedChapters.has(index)) {
                link.classList.add('bookmarked');
            }

            link.addEventListener('click', () => this.loadChapter(index));
            li.appendChild(link);
            currentSectionElement.appendChild(li);
        });

        this.updateActiveNavLink();
    }

    updateActiveNavLink() {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        const activeLink = document.querySelector(`[data-index="${this.currentChapterIndex}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
            activeLink.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    loadChapter(index) {
        if (index < 0 || index >= courseData.chapters.length) return;

        this.currentChapterIndex = index;
        const chapter = courseData.chapters[index];

        // Update content
        const contentEl = document.getElementById('chapterContent');
        contentEl.innerHTML = this.parseMarkdown(chapter.content);

        // Update breadcrumb
        const breadcrumb = document.getElementById('breadcrumb');
        breadcrumb.innerHTML = `
            <span class="breadcrumb-item">${chapter.section}</span>
            <span class="breadcrumb-item">${chapter.title}</span>
        `;

        // Update progress
        document.getElementById('currentChapter').textContent = index + 1;
        document.getElementById('totalChapters').textContent = courseData.chapters.length;

        // Update navigation buttons
        document.getElementById('prevBtn').disabled = index === 0;
        document.getElementById('nextBtn').disabled = index === courseData.chapters.length - 1;

        // Update complete button
        const completeBtn = document.getElementById('markCompleteBtn');
        if (this.completedChapters.has(index)) {
            completeBtn.classList.add('active');
            completeBtn.innerHTML = '<span class="icon">✓</span> Пройденное';
        } else {
            completeBtn.classList.remove('active');
            completeBtn.innerHTML = '<span class="icon">✓</span> Отметить как пройденное';
        }

        // Update bookmark button
        const bookmarkBtn = document.getElementById('bookmarkBtn');
        if (this.bookmarkedChapters.has(index)) {
            bookmarkBtn.classList.add('active');
            bookmarkBtn.innerHTML = '<span class="icon">★</span> В закладках';
        } else {
            bookmarkBtn.classList.remove('active');
            bookmarkBtn.innerHTML = '<span class="icon">☆</span> Добавить в закладки';
        }

        // Highlight code blocks
        if (window.hljs) {
            contentEl.querySelectorAll('pre code').forEach(block => {
                hljs.highlightElement(block);
            });
        }

        this.updateActiveNavLink();
        window.scrollTo(0, 0);
        this.saveProgress();
    }

    parseMarkdown(markdown) {
        let html = markdown;

        // Headers
        html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
        html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
        html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');

        // Bold and italic
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
        html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
        html = html.replace(/_(.*?)_/g, '<em>$1</em>');

        // Inline code
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Code blocks
        html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
            const language = '';
            const cleanCode = code.trim();
            return `<pre><code class="${language}">${this.escapeHtml(cleanCode)}</code></pre>`;
        });

        // Lists
        html = html.replace(/^\* (.*?)$/gm, '<li>$1</li>');
        html = html.replace(/^- (.*?)$/gm, '<li>$1</li>');
        html = html.replace(/^\d+\. (.*?)$/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*?<\/li>)/s, '<ul>$1</ul>');
        html = html.replace(/<\/ul>(\n)?<ul>/g, '');

        // Blockquotes
        html = html.replace(/^> (.*?)$/gm, '<blockquote>$1</blockquote>');
        html = html.replace(/(<blockquote>.*?<\/blockquote>)/s, (match) => {
            return match.replace(/\n/g, '<br>');
        });

        // Line breaks
        html = html.replace(/\n\n/g, '</p><p>');
        html = '<p>' + html + '</p>';
        html = html.replace(/<p>(<h[1-6].*?<\/h[1-6]>)<\/p>/g, '$1');
        html = html.replace(/<p>(<ul>.*?<\/ul>)<\/p>/g, '$1');
        html = html.replace(/<p>(<blockquote>.*?<\/blockquote>)<\/p>/g, '$1');
        html = html.replace(/<p>(<pre>.*?<\/pre>)<\/p>/g, '$1');
        html = html.replace(/<p><\/p>/g, '');

        // Links
        html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');

        return html;
    }

    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    previousChapter() {
        if (this.currentChapterIndex > 0) {
            this.loadChapter(this.currentChapterIndex - 1);
        }
    }

    nextChapter() {
        if (this.currentChapterIndex < courseData.chapters.length - 1) {
            this.loadChapter(this.currentChapterIndex + 1);
        }
    }

    toggleChapterComplete() {
        if (this.completedChapters.has(this.currentChapterIndex)) {
            this.completedChapters.delete(this.currentChapterIndex);
        } else {
            this.completedChapters.add(this.currentChapterIndex);
        }
        this.saveProgress();
        this.loadChapter(this.currentChapterIndex);
        this.updateStats();
        this.renderNavigation();
    }

    toggleBookmark() {
        if (this.bookmarkedChapters.has(this.currentChapterIndex)) {
            this.bookmarkedChapters.delete(this.currentChapterIndex);
        } else {
            this.bookmarkedChapters.add(this.currentChapterIndex);
        }
        this.saveProgress();
        this.loadChapter(this.currentChapterIndex);
        this.updateBookmarks();
        this.renderNavigation();
    }

    updateBookmarks() {
        const bookmarksList = document.getElementById('bookmarksList');
        
        if (this.bookmarkedChapters.size === 0) {
            bookmarksList.innerHTML = '<p class="empty-message">Нет закладок</p>';
            return;
        }

        bookmarksList.innerHTML = '';
        this.bookmarkedChapters.forEach(index => {
            const chapter = courseData.chapters[index];
            const item = document.createElement('div');
            item.className = 'bookmark-item';
            item.innerHTML = `
                <div class="bookmark-item-title">${chapter.title}</div>
                <div class="bookmark-item-section">${chapter.section}</div>
            `;
            item.addEventListener('click', () => this.loadChapter(index));
            bookmarksList.appendChild(item);
        });
    }

    updateStats() {
        const totalChapters = courseData.chapters.length;
        const completedChapters = this.completedChapters.size;
        const percentage = Math.round((completedChapters / totalChapters) * 100);

        // Update progress circle
        const circumference = 282.7;
        const offset = circumference - (percentage / 100) * circumference;
        document.querySelector('.progress-circle-fill').style.strokeDashoffset = offset;
        document.querySelector('.progress-percent').textContent = percentage + '%';

        // Update stats
        document.getElementById('totalChaptersStats').textContent = totalChapters;
        document.getElementById('completedChaptersStats').textContent = completedChapters;

        // Study time
        const hours = Math.floor(this.studyTimeSeconds / 3600);
        document.getElementById('studyTimeStats').textContent = hours + 'ч';

        // Streak
        document.getElementById('streakStats').textContent = this.streakDays;

        // Section completion
        const completionBySection = {};
        courseData.chapters.forEach((chapter, index) => {
            if (!completionBySection[chapter.section]) {
                completionBySection[chapter.section] = { total: 0, completed: 0 };
            }
            completionBySection[chapter.section].total++;
            if (this.completedChapters.has(index)) {
                completionBySection[chapter.section].completed++;
            }
        });

        const sectionEl = document.getElementById('completionBySection');
        sectionEl.innerHTML = '';
        Object.entries(completionBySection).forEach(([section, stats]) => {
            const percentage = Math.round((stats.completed / stats.total) * 100);
            const el = document.createElement('div');
            el.className = 'section-progress';
            el.innerHTML = `
                <div class="section-name">${section}</div>
                <div class="progress-bar">
                    <div class="progress-bar-fill" style="width: ${percentage}%"></div>
                </div>
            `;
            sectionEl.appendChild(el);
        });
    }

    saveProgress() {
        const progress = {
            currentChapterIndex: this.currentChapterIndex,
            completedChapters: Array.from(this.completedChapters),
            bookmarkedChapters: Array.from(this.bookmarkedChapters),
            studentName: this.studentName,
            studyTimeSeconds: this.studyTimeSeconds,
            streakDays: this.streakDays,
            lastStudyDate: this.lastStudyDate
        };
        localStorage.setItem('courseProgress', JSON.stringify(progress));
    }

    loadProgress() {
        const saved = localStorage.getItem('courseProgress');
        if (saved) {
            const progress = JSON.parse(saved);
            this.currentChapterIndex = progress.currentChapterIndex || 0;
            this.completedChapters = new Set(progress.completedChapters || []);
            this.bookmarkedChapters = new Set(progress.bookmarkedChapters || []);
            this.studentName = progress.studentName || 'Студент SQL Academy';
            this.studyTimeSeconds = progress.studyTimeSeconds || 0;
            this.streakDays = progress.streakDays || 0;
            this.lastStudyDate = progress.lastStudyDate || null;
            
            this.updateStreakDays();
        }
        this.updateBookmarks();
    }

    resetProgress() {
        if (confirm('Вы уверены? Это удалит все ваши закладки, отметки о завершении и статистику.')) {
            this.completedChapters.clear();
            this.bookmarkedChapters.clear();
            this.studyTimeSeconds = 0;
            this.streakDays = 0;
            this.currentChapterIndex = 0;
            this.saveProgress();
            this.loadChapter(0);
            this.renderNavigation();
            this.updateStats();
            this.updateBookmarks();
        }
    }

    showCertificate() {
        const certificateModal = document.getElementById('certificateModal');
        document.getElementById('certificateName').textContent = this.studentName;
        document.getElementById('certificateDate').textContent = new Date().toLocaleDateString('ru-RU');
        
        certificateModal.classList.add('active');
        document.getElementById('modalOverlay').classList.add('active');
    }

    toggleTheme() {
        const isDark = document.body.classList.toggle('dark-theme');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        this.updateThemeIcon();
    }

    applyTheme() {
        const theme = localStorage.getItem('theme') || 'light';
        if (theme === 'dark') {
            document.body.classList.add('dark-theme');
        }
        this.updateThemeIcon();
    }

    updateThemeIcon() {
        const icon = document.getElementById('themeToggle');
        const isDark = document.body.classList.contains('dark-theme');
        icon.textContent = isDark ? '☀️' : '🌙';
    }

    toggleSidebar() {
        const sidebar = document.querySelector('.sidebar');
        sidebar.classList.toggle('active');
    }

    switchTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
        document.getElementById(`${tab}Tab`).classList.add('active');
    }

    filterNavigation(query) {
        const searchTerm = query.toLowerCase();
        document.querySelectorAll('.nav-link').forEach(link => {
            const text = link.textContent.toLowerCase();
            const visible = text.includes(searchTerm) || searchTerm === '';
            link.closest('.nav-item').style.display = visible ? '' : 'none';
        });

        // Hide empty sections
        document.querySelectorAll('.nav-section').forEach(section => {
            const visibleItems = section.querySelectorAll('.nav-item:not([style*="display: none"])');
            section.style.display = visibleItems.length > 0 ? '' : 'none';
        });
    }

    startStudyTimer() {
        setInterval(() => {
            this.studyTimeSeconds++;
            this.updateStats();
            
            if (this.studyTimeSeconds % 300 === 0) { // Save every 5 minutes
                this.saveProgress();
            }
        }, 1000);
    }

    updateStreakDays() {
        const today = new Date().toDateString();
        if (this.lastStudyDate !== today) {
            const lastDate = this.lastStudyDate ? new Date(this.lastStudyDate) : new Date();
            const currentDate = new Date();
            const diffTime = currentDate - lastDate;
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays === 1) {
                this.streakDays++;
            } else if (diffDays > 1) {
                this.streakDays = 1;
            }
            
            this.lastStudyDate = today;
            this.saveProgress();
        }
    }

    handleKeyboardShortcuts(e) {
        // Alt + Left Arrow - Previous chapter
        if (e.altKey && e.key === 'ArrowLeft') {
            this.previousChapter();
        }
        // Alt + Right Arrow - Next chapter
        if (e.altKey && e.key === 'ArrowRight') {
            this.nextChapter();
        }
        // Alt + M - Mark complete
        if (e.altKey && e.key === 'm') {
            this.toggleChapterComplete();
        }
        // Alt + B - Bookmark
        if (e.altKey && e.key === 'b') {
            this.toggleBookmark();
        }
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
        document.getElementById('modalOverlay').classList.remove('active');
    }
}

// Global functions
function saveSettings() {
    const name = document.getElementById('studentNameInput').value;
    if (name) {
        app.studentName = name;
        app.saveProgress();
        closeModal('settingsModal');
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    document.getElementById('modalOverlay').classList.remove('active');
}

// Initialize app
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new CourseApp();
});
