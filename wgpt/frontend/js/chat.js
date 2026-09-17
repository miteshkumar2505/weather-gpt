/**
 * WeatherGPT — Chat Widget Logic
 * Handles the conversational AI chatbot panel, Voice Assistant, Text-to-Speech,
 * and Specialized Agriculture, Aviation, and Marine Advisories.
 */

const CHAT_API = `${window.location.origin}/api/chat`;

// ── State ──────────────────────────────────────────────────────
let chatSessionId = null;
let isChatOpen = false;
let isSending = false;
let autoTtsEnabled = false;
let currentAdvisoryMode = 'general'; // 'general' | 'agriculture' | 'aviation' | 'marine'

// ── Advisory Chips Configuration ───────────────────────────────
const ADVISORY_CHIPS = {
    general: {
        en: [
            { label: "🌡️ Current Weather", msg: "What's the weather right now?" },
            { label: "👁️ Visibility", msg: "Show me the visibility forecast" },
            { label: "📅 Forecast", msg: "Show me the 5-day forecast" },
            { label: "⚠️ Alerts", msg: "Are there any weather alerts?" },
            { label: "🌧️ Rain?", msg: "Will it rain today?" },
            { label: "📋 3 Sectors Overview", msg: "Explain general weather requirements for agriculture, aviation, and marine" },
        ],
        hi: [
            { label: "🌡️ वर्तमान मौसम", msg: "अभी का मौसम कैसा है?" },
            { label: "👁️ दृश्यता", msg: "दृश्यता का पूर्वानुमान दिखाएं" },
            { label: "📅 पूर्वानुमान", msg: "5-दिवसीय मौसम पूर्वानुमान दिखाएं" },
            { label: "⚠️ अलर्ट", msg: "क्या कोई मौसम अलर्ट है?" },
            { label: "🌧️ क्या बारिश होगी?", msg: "क्या आज बारिश होगी?" },
            { label: "📋 3 क्षेत्रों का अवलोकन", msg: "कृषि, विमानन और समुद्री क्षेत्रों के लिए सामान्य मौसम आवश्यकताओं को समझाएं" },
        ],
        gu: [
            { label: "🌡️ વર્તમાન હવામાન", msg: "અત્યારે હવામાન કેવું છે?" },
            { label: "👁️ દૃશ્યતા", msg: "દૃશ્યતા અંદાજ બતાવો" },
            { label: "📅 હવામાન અંદાજ", msg: "5-દિવસનો હવામાન અંદાજ બતાવો" },
            { label: "⚠️ અલર્ટ્સ", msg: "શું કોઈ હવામાન અલર્ટ છે?" },
            { label: "🌧️ શું વરસાદ પડશે?", msg: "શું આજે વરસાદ પડશે?" },
            { label: "📋 3 ક્ષેત્રોની ઝાંખી", msg: "કૃષિ, ઉડ્ડયન અને દરિયાઈ ક્ષેત્રો માટે સામાન્ય હવામાન જરૂરિયાતો સમજાવો" },
        ],
    },
    agriculture: {
        en: [
            { label: "🚜 Spraying Window", msg: "Give me an agriculture advisory: Can I spray pesticides or fertilizers today?" },
            { label: "💧 Irrigation Advice", msg: "What is the irrigation advisory for crops based on humidity and rain forecast?" },
            { label: "🐛 Pest & Disease Risk", msg: "What is the pest and fungal disease risk for crops right now?" },
            { label: "🌾 Harvest & Field Care", msg: "Is the weather suitable for harvesting and field operations?" },
            { label: "📋 Agri Requirements", msg: "What are the general weather requirements and critical thresholds for agriculture?" },
        ],
        hi: [
            { label: "🚜 कीटनाशक छिड़काव", msg: "कृषि सलाहकार: क्या आज कीटनाशक या खाद का छिड़काव करना सुरक्षित है?" },
            { label: "💧 सिंचाई सलाह", msg: "फसलों के लिए आर्द्रता और बारिश के आधार पर सिंचाई की क्या सलाह है?" },
            { label: "🐛 कीट एवं रोग जोखिम", msg: "वर्तमान मौसम में फसलों पर कीट और कवक रोगों का क्या जोखिम है?" },
            { label: "🌾 कटाई एवं खेत कार्य", msg: "क्या मौसम फसल कटाई और खेत के कामों के लिए अनुकूल है?" },
            { label: "📋 कृषि मौसम जरूरतें", msg: "कृषि के लिए मौसम की सामान्य आवश्यकताएं और महत्वपूर्ण सीमाएं क्या हैं?" },
        ],
        gu: [
            { label: "🚜 જંતુનાશક છંટકાવ", msg: "કૃષિ સલાહ: શું આજે જંતુનાશક દવા કે ખાતરનો છંટકાવ કરવો યોગ્ય છે?" },
            { label: "💧 પિયત / સિંચાઈ સલાહ", msg: "ભેજ અને વરસાદના આધારે પાક માટે સિંચાઈની શું સલાહ છે?" },
            { label: "🐛 જીવાત અને રોગ જોખમ", msg: "હાલના હવામાનમાં પાકમાં જીવાત અને ફૂગના રોગનું કેટલું જોખમ છે?" },
            { label: "🌾 લણણી અને ખેત કામ", msg: "શું હવામાન પાકની લણણી અને ખેતી કામ માટે અનુકૂળ છે?" },
            { label: "📋 કૃષિ હવામાન જરૂરિયાતો", msg: "ખેતીવાડી માટે હવામાનની સામાન્ય જરૂરિયાતો અને મુખ્ય માપદંડો શું છે?" },
        ],
    },
    aviation: {
        en: [
            { label: "🛩️ Flight Category (VFR/IFR)", msg: "Provide aviation weather briefing: What is the flight category (VFR, MVFR, IFR)?" },
            { label: "💨 Runway Wind & Gusts", msg: "What are runway winds, crosswind risks, and gust potential?" },
            { label: "👁️ Visibility & Ceiling", msg: "What is the flight visibility and estimated cloud ceiling base?" },
            { label: "🧭 QNH Altimeter", msg: "What is the altimeter setting (QNH in hPa and inHg)?" },
            { label: "📋 Aviation Requirements", msg: "What are the general weather requirements and operational thresholds for aviation?" },
        ],
        hi: [
            { label: "🛩️ उड़ान श्रेणी (VFR/IFR)", msg: "विमानन मौसम ब्रीफिंग: उड़ान श्रेणी VFR या IFR क्या है?" },
            { label: "💨 रनवे हवा व झोंके", msg: "रनवे पर हवा की गति, दिशा, क्रॉसविंड और झोंके क्या हैं?" },
            { label: "👁️ दृश्यता एवं सीलिंग", msg: "उड़ान दृश्यता और बादलों की अनुमानित सीलिंग ऊंचाई क्या है?" },
            { label: "🧭 अल्टीमीटर (QNH)", msg: "इस स्थान के लिए बैरोमीटर अल्टीमीटर सेटिंग (QNH) क्या है?" },
            { label: "📋 विमानन मौसम जरूरतें", msg: "विमान संचालन और पायलटों के लिए सामान्य मौसम आवश्यकताएं क्या हैं?" },
        ],
        gu: [
            { label: "🛩️ ફ્લાઇટ કેટેગરી (VFR/IFR)", msg: "એવિએશન વેધર બ્રીફિંગ: ફ્લાઇટ કેટેગરી VFR કે IFR શું છે?" },
            { label: "💨 રનવે પવન અને ઝોંકા", msg: "રનવે પર પવનની ગતિ, દિશા, ક્રોસવિન્ડ અને ઝોંકા કેવા છે?" },
            { label: "👁️ દૃશ્યતા અને સીલિંગ", msg: "ફ્લાઇટ દૃશ્યતા અને વાદળ સીલિંગની ઊંચાઈ કેટલી છે?" },
            { label: "🧭 અલ્ટિમીટર (QNH)", msg: "આ એરપોર્ટ માટે બેરોમેટ્રિક અલ્ટિમીટર (QNH) કેટલું છે?" },
            { label: "📋 એવિએશન જરૂરિયાતો", msg: "વિમાન સંચાલન માટે સામાન્ય હવામાન જરૂરિયાતો અને મર્યાદાઓ શું છે?" },
        ],
    },
    marine: {
        en: [
            { label: "🎣 Fishermen Warning", msg: "Provide marine advisory: Is it safe for fishermen to venture into the sea?" },
            { label: "🌊 Sea State & Waves", msg: "What is the sea condition, wave height, and swell status?" },
            { label: "⛵ Beaufort Wind Scale", msg: "What is the marine wind and Beaufort force scale?" },
            { label: "🚢 Coastal & Port Ops", msg: "What are the coastal navigation, visibility, and port conditions?" },
            { label: "📋 Marine Requirements", msg: "What are the general weather requirements and safety thresholds for marine and fishermen?" },
        ],
        hi: [
            { label: "🎣 मछुआरे चेतावनी", msg: "समुद्री सलाह: क्या मछुआरों के लिए गहरे या तटीय समुद्र में जाना सुरक्षित है?" },
            { label: "🌊 समुद्र स्थिति व लहरें", msg: "समुद्र की स्थिति और अनुमानित लहरों की ऊंचाई क्या है?" },
            { label: "⛵ ब्यूफोर्ट पवन स्केल", msg: "समुद्री हवा और ब्यूफोर्ट स्केल फोर्स क्या है?" },
            { label: "🚢 तटीय व बंदरगाह मौसम", msg: "तटीय नेविगेशन और बंदरगाह की मौसम स्थिति कैसी है?" },
            { label: "📋 समुद्री मौसम जरूरतें", msg: "समुद्री संचालन और मछुआरों के लिए सामान्य मौसम आवश्यकताएं क्या हैं?" },
        ],
        gu: [
            { label: "🎣 માછીમાર ચેતવણી", msg: "દરિયાઈ સલાહ: શું માછીમારો માટે દરિયો ખેડવો સલામત છે?" },
            { label: "🌊 દરિયાની સ્થિતિ અને મોજા", msg: "દરિયાની સ્થિતિ અને અંદાજિત મોજાની ઊંચાઈ કેટલી છે?" },
            { label: "⛵ બ્યુફોર્ટ પવન સ્કેલ", msg: "દરિયાઈ પવન અને બ્યુફોર્ટ સ્કેલ ફોર્સ કેટલો છે?" },
            { label: "🚢 બંદર અને તટીય હવામાન", msg: "બંદર અને દરિયાકાંઠાના નેવિગેશન માટે હવામાન કેવું છે?" },
            { label: "📋 દરિયાઈ જરૂરિયાતો", msg: "દરિયાઈ કામગીરી અને માછીમારો માટે હવામાનની સામાન્ય જરૂરિયાતો શું છે?" },
        ],
    },
};

// ── DOM Elements ───────────────────────────────────────────────
const chatFab = document.getElementById('chat-fab');
const chatPanel = document.getElementById('chat-panel');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send-btn');
const chatCloseBtn = document.getElementById('chat-close-btn');
const chatVoiceBtn = document.getElementById('chat-voice-btn');
const ttsToggleBtn = document.getElementById('tts-toggle-btn');
const typingIndicator = document.getElementById('typing-indicator');
const advisoryTabsContainer = document.getElementById('chat-advisory-tabs');
const quickActionsContainer = document.getElementById('chat-quick-actions');

// ── Initialize ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    setupChat();
    setupChatVoice();
    setupAdvisoryTabs();
    renderQuickChips();
    addWelcomeMessage();
});

function setupChat() {
    // Toggle chat panel
    chatFab.addEventListener('click', () => toggleChat(true));
    chatCloseBtn.addEventListener('click', () => toggleChat(false));

    // Auto TTS Toggle
    if (ttsToggleBtn) {
        ttsToggleBtn.addEventListener('click', () => {
            autoTtsEnabled = !autoTtsEnabled;
            ttsToggleBtn.classList.toggle('active', autoTtsEnabled);
            ttsToggleBtn.title = autoTtsEnabled ? "Auto Read-Aloud Voice Enabled" : "Toggle Auto Read-Aloud Voice";
        });
    }

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
}

function setupAdvisoryTabs() {
    if (!advisoryTabsContainer) return;

    const tabs = advisoryTabsContainer.querySelectorAll('.advisory-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const mode = tab.dataset.mode;
            if (mode === currentAdvisoryMode) return;

            tabs.forEach(t => {
                t.classList.remove('active');
                t.setAttribute('aria-selected', 'false');
            });

            tab.classList.add('active');
            tab.setAttribute('aria-selected', 'true');
            currentAdvisoryMode = mode;

            renderQuickChips();
        });
    });
}

function renderQuickChips() {
    if (!quickActionsContainer) return;

    const lang = window.currentLang || 'en';
    const modeConfig = ADVISORY_CHIPS[currentAdvisoryMode] || ADVISORY_CHIPS.general;
    const chips = modeConfig[lang] || modeConfig.en || [];

    quickActionsContainer.innerHTML = '';

    chips.forEach(chip => {
        const btn = document.createElement('button');
        btn.className = 'quick-chip';
        btn.textContent = chip.label;
        btn.dataset.message = chip.msg;
        btn.addEventListener('click', () => {
            chatInput.value = chip.msg;
            sendMessage();
        });
        quickActionsContainer.appendChild(btn);
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
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
    }
}

// ── Voice Speech-to-Text ───────────────────────────────────────
function setupChatVoice() {
    if (!chatVoiceBtn) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        chatVoiceBtn.style.opacity = '0.5';
        chatVoiceBtn.title = 'Voice recognition not supported';
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = window.currentLang === 'hi' ? 'hi-IN' : (window.currentLang === 'gu' ? 'gu-IN' : 'en-US');

    let isListening = false;

    chatVoiceBtn.addEventListener('click', () => {
        if (isListening) {
            recognition.stop();
            return;
        }

        try {
            recognition.lang = window.currentLang === 'hi' ? 'hi-IN' : (window.currentLang === 'gu' ? 'gu-IN' : 'en-US');
            recognition.start();
            isListening = true;
            chatVoiceBtn.classList.add('recording');
            chatVoiceBtn.title = 'Listening... Speak your prompt';
        } catch (err) {
            console.error('Speech recognition error:', err);
        }
    });

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.trim();
        if (transcript) {
            chatInput.value = transcript;
            chatInput.style.height = 'auto';
            chatInput.style.height = Math.min(chatInput.scrollHeight, 100) + 'px';
            sendMessage();
        }
    };

    recognition.onend = () => {
        isListening = false;
        chatVoiceBtn.classList.remove('recording');
        chatVoiceBtn.title = 'Speak to WeatherGPT (Voice Assistant)';
    };

    recognition.onerror = (event) => {
        console.warn('Voice chat error:', event.error);
        isListening = false;
        chatVoiceBtn.classList.remove('recording');
    };
}

// ── Text-to-Speech (TTS) ───────────────────────────────────────
function speakText(text, btnElement = null) {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();

    // Clean markdown, html tags, and emojis for speech
    const cleanText = text
        .replace(/<[^>]*>?/gm, '')
        .replace(/[*#_~`>-]/g, ' ')
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    if (btnElement) {
        btnElement.classList.add('speaking');
        utterance.onend = () => btnElement.classList.remove('speaking');
        utterance.onerror = () => btnElement.classList.remove('speaking');
    }

    window.speechSynthesis.speak(utterance);
}

// ── Messages ───────────────────────────────────────────────────
function addWelcomeMessage() {
    const welcomeHtml = `
        <p>👋 <strong>Hello! I'm WeatherGPT</strong>, your AI weather & multi-sector advisory assistant.</p>
        <p>I provide real-time forecasts & special advisories for:</p>
        <p style="line-height: 1.6; margin: 6px 0;">
            🌾 <strong>Agriculture</strong> — Spraying windows, irrigation & pest risk<br>
            ✈️ <strong>Aviation</strong> — Flight rules (VFR/IFR), ceiling & runway winds<br>
            ⚓ <strong>Marine</strong> — Fishermen safety, sea state & Beaufort scale<br>
            🌡️ <strong>Real-time Weather</strong> — 5-day forecasts & climate insights
        </p>
        <p>Select an advisory tab above or ask me anything!</p>
    `;
    appendMessage('assistant', welcomeHtml, true);
}

function appendMessage(role, content, isHtml = false) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${role}`;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const bubbleContent = isHtml ? content : escapeHtml(content);
    const speechBtnId = `speech-btn-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

    msgDiv.innerHTML = `
        <div class="chat-bubble">
            ${role === 'assistant' ? formatMarkdown(bubbleContent) : bubbleContent}
        </div>
        <div class="chat-time" style="display: flex; align-items: center;">
            ${time}
            ${role === 'assistant' ? `<button class="speech-msg-btn" id="${speechBtnId}" title="Read out message">🔊</button>` : ''}
        </div>
    `;

    // Insert before typing indicator
    chatMessages.insertBefore(msgDiv, typingIndicator);
    scrollToBottom();

    // Attach speech event listener to assistant messages
    if (role === 'assistant') {
        const btn = document.getElementById(speechBtnId);
        if (btn) {
            btn.addEventListener('click', () => speakText(content, btn));
        }

        if (autoTtsEnabled) {
            speakText(content, btn);
        }
    }
}

function formatMarkdown(text) {
    return text
        .replace(/### (.*?)\n/g, '<h4 style="margin: 8px 0 4px; color: #38bdf8; font-size: 0.95rem;">$1</h4>')
        .replace(/## (.*?)\n/g, '<h3 style="margin: 10px 0 6px; color: #60a5fa; font-size: 1.02rem;">$1</h3>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^• (.*?)$/gm, '<li style="margin-left: 14px;">$1</li>')
        .replace(/^- (.*?)$/gm, '<li style="margin-left: 14px;">$1</li>')
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
        console.log("Selected city:", window.currentCity, "Language:", window.currentLang, "Advisory Mode:", currentAdvisoryMode);
        const resp = await fetch(CHAT_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: message,
                session_id: chatSessionId,
                city: window.currentCity || null,
                language: window.currentLang || 'en',
                advisory_type: currentAdvisoryMode,
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

// ── Update Chat UI for Language ────────────────────────────────
window.updateChatLanguageUI = function (lang) {
    renderQuickChips();
};

// ── Quick City from Chat ───────────────────────────────────────
window.chatLoadCity = function (city) {
    if (typeof loadWeatherByCity === 'function') {
        loadWeatherByCity(city);
    }
};
