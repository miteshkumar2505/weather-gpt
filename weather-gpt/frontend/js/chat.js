/**
 * WeatherGPT — Chat Widget Logic
 * Handles the conversational AI chatbot panel.
 */

const CHAT_API = `${window.location.origin}/api/chat`;

// ── State ──────────────────────────────────────────────────────
let chatSessionId = null;
let isChatOpen = false;
let isSending = false;

// ── DOM Elements ───────────────────────────────────────────────
const chatFab = document.getElementById('chat-fab');
const chatPanel = document.getElementById('chat-panel');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send-btn');
const chatCloseBtn = document.getElementById('chat-close-btn');
const typingIndicator = document.getElementById('typing-indicator');

// ── Initialize ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    setupChat();
    addWelcomeMessage();
});

function setupChat() {
    // Toggle chat panel
    chatFab.addEventListener('click', () => toggleChat(true));
    chatCloseBtn.addEventListener('click', () => toggleChat(false));

    // Send message
    chatSendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Auto-resize textarea
    chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 100) + 'px';
    });

    // Quick action chips
    document.querySelectorAll('.quick-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            chatInput.value = chip.dataset.message;
            sendMessage();
        });
    });
}

function toggleChat(open) {
    isChatOpen = open;
    if (open) {
        chatPanel.classList.add('active');
        chatFab.classList.add('hidden');
        chatInput.focus();
    } else {
        chatPanel.classList.remove('active');
        chatFab.classList.remove('hidden');
    }
}

// ── Messages ───────────────────────────────────────────────────
function addWelcomeMessage() {
    const welcomeHtml = `
        <p>👋 <strong>Hello! I'm WeatherGPT</strong>, your AI weather assistant.</p>
        <p>I can help you with:</p>
        <p>🌡️ Current weather conditions<br>
        📅 Weather forecasts<br>
        ⚠️ Weather alerts & warnings<br>
        🌊 Climate insights & monsoon info<br>
        🛡️ Disaster preparedness tips</p>
        <p>Try asking me something like <em>"What's the weather in Mumbai?"</em></p>
    `;
    appendMessage('assistant', welcomeHtml, true);
}

function appendMessage(role, content, isHtml = false) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${role}`;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const bubbleContent = isHtml ? content : escapeHtml(content);

    msgDiv.innerHTML = `
        <div class="chat-bubble">${role === 'assistant' ? formatMarkdown(bubbleContent) : bubbleContent}</div>
        <div class="chat-time">${time}</div>
    `;

    // Insert before typing indicator
    chatMessages.insertBefore(msgDiv, typingIndicator);
    scrollToBottom();
}

function formatMarkdown(text) {
    // Simple markdown-like formatting
    return text
        // Bold
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Line breaks
        .replace(/\n/g, '<br>');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showTyping() {
    typingIndicator.classList.add('active');
    scrollToBottom();
}

function hideTyping() {
    typingIndicator.classList.remove('active');
}

function scrollToBottom() {
    requestAnimationFrame(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });
}

// ── Send Message ───────────────────────────────────────────────
async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message || isSending) return;

    // Add user message
    appendMessage('user', message);
    chatInput.value = '';
    chatInput.style.height = 'auto';

    // Disable input
    isSending = true;
    chatSendBtn.disabled = true;
    showTyping();

    try {
        const resp = await fetch(CHAT_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: message,
                session_id: chatSessionId,
            }),
        });

        if (!resp.ok) {
            throw new Error(`Chat API error: ${resp.status}`);
        }

        const data = await resp.json();
        chatSessionId = data.session_id;

        hideTyping();
        appendMessage('assistant', data.reply);

    } catch (err) {
        console.error('Chat error:', err);
        hideTyping();
        appendMessage('assistant', '❌ Sorry, I encountered an error. Please make sure the server is running and your Gemini API key is configured correctly.');
    } finally {
        isSending = false;
        chatSendBtn.disabled = false;
        chatInput.focus();
    }
}

// ── Quick City from Chat ───────────────────────────────────────
// Allow chat to trigger weather loads
window.chatLoadCity = function(city) {
    if (typeof loadWeatherByCity === 'function') {
        loadWeatherByCity(city);
    }
};
