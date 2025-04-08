document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    // Ensure all IDs match index.html exactly
    const settingsButton = document.getElementById('settings-button');
    const settingsPanel = document.getElementById('settings-panel');
    const closeSettingsButton = document.getElementById('close-settings-button');
    const apiKeyInput = document.getElementById('api-key');
    const loadModelsButton = document.getElementById('load-models-button');
    const newChatButton = document.getElementById('new-chat-button');
    const chatListUL = document.getElementById('chat-list');
    const systemPromptInput = document.getElementById('system-prompt-input');
    const chatBox = document.getElementById('chat-box');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const modelSelect = document.getElementById('model-select');
    const voiceSelect = document.getElementById('voice-select');
    const speedSlider = document.getElementById('speed-slider');
    const speedValueSpan = document.getElementById('speed-value');
    const statusElement = document.getElementById('status');
    const audioPlayer = document.getElementById('audio-player');

    // LLM Parameter Elements
    const paramTemperatureSlider = document.getElementById('param-temperature');
    const paramTemperatureValue = document.getElementById('param-temperature-value');
    const paramMaxTokensInput = document.getElementById('param-max-tokens');
    const paramTopPSlider = document.getElementById('param-top-p');
    const paramTopPValue = document.getElementById('param-top-p-value');
    const paramFreqPenaltySlider = document.getElementById('param-frequency-penalty');
    const paramFreqPenaltyValue = document.getElementById('param-frequency-penalty-value');
    const paramPresPenaltySlider = document.getElementById('param-presence-penalty');
    const paramPresPenaltyValue = document.getElementById('param-presence-penalty-value');


    // --- Constants & State ---
    const GROQ_API_BASE = 'https://api.groq.com/openai/v1';
    const TTS_MODEL = "playai-tts";
    const AVAILABLE_ENGLISH_VOICES = [
        "Arista-PlayAI", "Atlas-PlayAI", "Basil-PlayAI", "Briggs-PlayAI",
        "Calum-PlayAI", "Celeste-PlayAI", "Cheyenne-PlayAI", "Chip-PlayAI",
        "Cillian-PlayAI", "Deedee-PlayAI", "Fritz-PlayAI", "Gail-PlayAI",
        "Indigo-PlayAI", "Mamaw-PlayAI", "Mason-PlayAI", "Mikail-PlayAI",
        "Mitch-PlayAI", "Quinn-PlayAI", "Thunder-PlayAI"
    ];
    const DEFAULT_VOICE = "Fritz-PlayAI";
    const DEFAULT_CHAT_MODEL = "llama3-8b-8192";
    const DEFAULT_SYSTEM_PROMPT = "You are a helpful assistant.";
    const LOCAL_STORAGE_CHATS_KEY = 'groq_saved_chats';
    const LOCAL_STORAGE_ACTIVE_CHAT_KEY = 'groq_active_chat_id';
    const LOCAL_STORAGE_LLM_PARAMS_KEY = 'groq_llm_params'; // Key for saving params

    let savedChats = []; // Array to hold all chat objects {id, name, systemPrompt, messages, createdAt?, lastUpdated?}
    let activeChatId = null; // ID of the currently active chat

    let isProcessingSend = false;
    let currentAudio = null; // Reference to the currently playing/loaded audio
    let modelsLoaded = false; // Track if models have been loaded

    // State for LLM parameters
    let currentLLMParams = {
        temperature: 0.7,
        max_completion_tokens: 8192, // Default value
        top_p: 1.0,
        frequency_penalty: 0.0,
        presence_penalty: 0.0,
        // Add 'stop': null later if needed and want to control it
    };

    // --- Initialization ---
    function initializeApp() {
        console.log("Initializing app...");
        loadLLMParamsFromStorage(); // Load saved params first
        updateParamUIFromState(); // Set initial UI values for params
        populateVoices();
        updateSpeedDisplay();
        loadChatsFromStorage(); // Load saved chats
        populateChatList(); // Display loaded chats in the sidebar
        loadActiveChat(); // Load the last active or start new one
        setupEventListeners(); // Setup ALL listeners, including new param ones
        setStatus('Ready');
        userInput.focus(); // Focus on main input
         console.log("App Initialized.");
         // Attempt to load models if API key exists on load (e.g., from browser autofill)
         if(apiKeyInput.value.trim()){
             console.log("API key found on init, attempting to load models.");
             fetchAndPopulateModels();
         }
    }

    // --- NEW: LLM Parameter Management ---
    function loadLLMParamsFromStorage() {
        try {
            const storedParams = localStorage.getItem(LOCAL_STORAGE_LLM_PARAMS_KEY);
            if (storedParams) {
                const parsedParams = JSON.parse(storedParams);
                // Merge defaults with loaded params to handle missing keys if format changes
                currentLLMParams = { ...currentLLMParams, ...parsedParams };
                console.log("LLM params loaded from storage:", currentLLMParams);
            } else {
                 console.log("No LLM params found in storage, using defaults.");
            }
        } catch(e) {
             console.error("Error loading LLM params from storage:", e);
             // Keep defaults if loading fails
        }
    }

    function saveLLMParamsToStorage() {
         try {
            // Ensure max_completion_tokens is a number before saving
            currentLLMParams.max_completion_tokens = parseInt(currentLLMParams.max_completion_tokens, 10) || 1024; // Fallback if parsing fails
            localStorage.setItem(LOCAL_STORAGE_LLM_PARAMS_KEY, JSON.stringify(currentLLMParams));
             console.log("LLM params saved to storage:", currentLLMParams);
         } catch(e) {
              console.error("Error saving LLM params to storage:", e);
         }
    }

    // Update the UI input elements to reflect the current state values
    function updateParamUIFromState() {
        if (paramTemperatureSlider) paramTemperatureSlider.value = currentLLMParams.temperature;
        if (paramTemperatureValue) paramTemperatureValue.textContent = parseFloat(currentLLMParams.temperature).toFixed(1);
        if (paramMaxTokensInput) paramMaxTokensInput.value = currentLLMParams.max_completion_tokens;
        if (paramTopPSlider) paramTopPSlider.value = currentLLMParams.top_p;
        if (paramTopPValue) paramTopPValue.textContent = parseFloat(currentLLMParams.top_p).toFixed(2); // Use 2 decimal places for top_p
        if (paramFreqPenaltySlider) paramFreqPenaltySlider.value = currentLLMParams.frequency_penalty;
        if (paramFreqPenaltyValue) paramFreqPenaltyValue.textContent = parseFloat(currentLLMParams.frequency_penalty).toFixed(1);
        if (paramPresPenaltySlider) paramPresPenaltySlider.value = currentLLMParams.presence_penalty;
        if (paramPresPenaltyValue) paramPresPenaltyValue.textContent = parseFloat(currentLLMParams.presence_penalty).toFixed(1);
    }

    // Handle updates from the UI controls
    function handleParamChange(event) {
        const target = event.target;
        // Use parseFloat for ranges, parseInt for number inputs
        const value = target.type === 'range' ? parseFloat(target.value) : parseInt(target.value, 10);
        const paramName = target.id.replace('param-', ''); // e.g., 'temperature' or 'max-tokens' -> needs adjustment

        // Adjust paramName for kebab-case IDs like 'max-tokens'
        const stateKey = paramName.replace(/-([a-z])/g, (g) => g[1].toUpperCase()); // Convert max-tokens to maxCompletionTokens if needed (API uses max_completion_tokens though)
        const finalKey = stateKey === 'maxTokens' ? 'max_completion_tokens' : stateKey.replace('freqPenalty', 'frequency_penalty').replace('presPenalty', 'presence_penalty'); // Map UI ID name to state key name


        if (finalKey in currentLLMParams) {
             // Special handling for max tokens - ensure it's a valid number > 0
             if (finalKey === 'max_completion_tokens') {
                 currentLLMParams[finalKey] = Math.max(1, value || 1024); // Ensure positive integer, default 1024 if invalid
                 // Optionally update the input field value if it was adjusted
                 if(target.value != currentLLMParams[finalKey]) {
                     target.value = currentLLMParams[finalKey];
                 }
             } else {
                currentLLMParams[finalKey] = value;
             }


             // Update corresponding value display span if it exists for sliders
             const valueSpan = document.getElementById(`${target.id}-value`);
             if (valueSpan) {
                 let precision = 1; // Default precision
                 if (target.step.includes('.')) {
                     const decimalPart = target.step.split('.')[1];
                     precision = decimalPart ? decimalPart.length : 1; // Determine precision from step
                 }
                 valueSpan.textContent = value.toFixed(precision);
             }

            saveLLMParamsToStorage(); // Save immediately on change
            console.log("LLM param changed:", finalKey, currentLLMParams[finalKey]);
        } else {
             console.warn("Unhandled param change for ID:", target.id, "Mapped Key:", finalKey);
        }
    }


    // --- Chat History Management ---
    function loadChatsFromStorage() {
        try {
            const storedChats = localStorage.getItem(LOCAL_STORAGE_CHATS_KEY);
            if (storedChats) {
                savedChats = JSON.parse(storedChats);
                if (!Array.isArray(savedChats)) savedChats = []; // Ensure it's an array
            } else {
                savedChats = [];
            }
            const storedActiveId = localStorage.getItem(LOCAL_STORAGE_ACTIVE_CHAT_KEY);
            activeChatId = storedActiveId;

        } catch (e) {
            console.error("Error loading chats from localStorage:", e);
            savedChats = [];
            activeChatId = null;
        }
    }

    function saveChatsToStorage() {
        try {
            localStorage.setItem(LOCAL_STORAGE_CHATS_KEY, JSON.stringify(savedChats));
            if (activeChatId) {
                localStorage.setItem(LOCAL_STORAGE_ACTIVE_CHAT_KEY, activeChatId);
            } else {
                localStorage.removeItem(LOCAL_STORAGE_ACTIVE_CHAT_KEY);
            }
        } catch (e) {
            console.error("Error saving chats to localStorage:", e);
            setStatus("Error saving chat history.", "error");
        }
    }

    function getActiveChatMessages() {
         if (!activeChatId) return [];
         const activeChat = savedChats.find(chat => chat.id === activeChatId);
         // Ensure messages array exists
         return activeChat ? (activeChat.messages || []) : [];
    }

    function saveCurrentChatState() {
        if (!activeChatId) return;

        const currentSystemPrompt = systemPromptInput.value.trim() || DEFAULT_SYSTEM_PROMPT;
        const currentMessages = getActiveChatMessages(); // Get messages linked to this ID

        let chatIndex = savedChats.findIndex(chat => chat.id === activeChatId);
        let chatName = generateChatName(currentMessages); // Generate name here

        if (chatIndex !== -1) {
            // Update existing chat
            savedChats[chatIndex].systemPrompt = currentSystemPrompt;
            savedChats[chatIndex].messages = currentMessages; // Ensure messages array is up-to-date
            savedChats[chatIndex].lastUpdated = Date.now();
            // Update name if needed (e.g., if first message changed)
            if(savedChats[chatIndex].name !== chatName && (!savedChats[chatIndex].name || savedChats[chatIndex].name.startsWith("Chat ")) ) {
                 savedChats[chatIndex].name = chatName;
                 updateChatListItemName(activeChatId, chatName);
            }
        } else {
            // Add new chat (occurs after first message exchange in a 'new' chat)
            const newChat = {
                id: activeChatId,
                name: chatName,
                systemPrompt: currentSystemPrompt,
                messages: currentMessages, // Should include the first user/assistant pair now
                createdAt: Date.now(),
                lastUpdated: Date.now()
            };
            savedChats.push(newChat);
            // Ensure it's added to UI list if not already there
            if (!document.querySelector(`#chat-list li[data-chat-id="${activeChatId}"]`)) {
                 addChatToListUI(newChat);
                 updateChatListActiveState(); // Highlight the newly added chat
            } else {
                updateChatListItemName(activeChatId, chatName); // Update name just in case
            }
        }
        saveChatsToStorage();
    }

    function handleNewChat() {
        stopAndClearAudio(); // Stop audio if playing
        activeChatId = generateChatId();
        systemPromptInput.value = DEFAULT_SYSTEM_PROMPT;
        chatBox.innerHTML = '';
        updateChatListActiveState();
        setStatus('New chat started. Type a message.');
        userInput.focus();
        // Save immediately to persist the active ID, even if empty
        saveChatsToStorage();
    }

    function handleSwitchChat(chatId) {
        if (chatId === activeChatId) return;

        stopAndClearAudio();
        const chatToLoad = savedChats.find(chat => chat.id === chatId);
        if (chatToLoad) {
            activeChatId = chatId;
            loadChatIntoUI(chatToLoad);
            updateChatListActiveState();
            saveChatsToStorage(); // Save the new active chat ID
            setStatus(`Switched to chat: ${chatToLoad.name || 'Unnamed Chat'}`);
            userInput.focus();
        } else {
            console.error(`Chat with ID ${chatId} not found.`);
            setStatus(`Error switching chat.`, 'error');
        }
    }

    function handleDeleteChat(event, chatId) {
        event.stopPropagation();

        const chatToDelete = savedChats.find(c=>c.id===chatId);
        if (!confirm(`Are you sure you want to delete chat "${chatToDelete?.name || chatId}"?`)) {
            return;
        }

        stopAndClearAudio();
        const chatIndex = savedChats.findIndex(chat => chat.id === chatId);
        if (chatIndex > -1) {
            savedChats.splice(chatIndex, 1);

            const listItem = document.querySelector(`#chat-list li[data-chat-id="${chatId}"]`);
            if (listItem) listItem.remove();

            if (activeChatId === chatId) {
                activeChatId = null;
                if (savedChats.length > 0) {
                     // Sort again to find the most recent to switch to
                     savedChats.sort((a, b) => (b.lastUpdated || b.createdAt || 0) - (a.lastUpdated || a.createdAt || 0));
                    handleSwitchChat(savedChats[0].id);
                } else {
                    handleNewChat();
                }
            } else {
                 saveChatsToStorage(); // Save removal if deleted wasn't active
            }
            setStatus('Chat deleted.');
        }
    }


    function loadActiveChat() {
        if (activeChatId) {
            const chatToLoad = savedChats.find(chat => chat.id === activeChatId);
            if (chatToLoad) {
                loadChatIntoUI(chatToLoad);
                updateChatListActiveState();
                return;
            } else {
                activeChatId = null;
                localStorage.removeItem(LOCAL_STORAGE_ACTIVE_CHAT_KEY);
            }
        }

        // Fallback logic if no active chat ID or it was invalid
        if (savedChats.length > 0) {
             // Sort to load the most recently updated chat
             savedChats.sort((a, b) => (b.lastUpdated || b.createdAt || 0) - (a.lastUpdated || a.createdAt || 0));
            handleSwitchChat(savedChats[0].id);
        } else {
            handleNewChat();
        }
    }

    function loadChatIntoUI(chatData) {
        systemPromptInput.value = chatData.systemPrompt || DEFAULT_SYSTEM_PROMPT;
        chatBox.innerHTML = '';
        (chatData.messages || []).forEach(msg => {
            addMessageToChat(msg.role === 'user' ? 'You' : 'Assistant', msg.content, msg.role);
        });
        setTimeout(() => { if(chatBox.scrollHeight > chatBox.clientHeight) chatBox.scrollTop = chatBox.scrollHeight; }, 100); // Scroll only if needed
    }


    // --- UI Population ---
    function populateChatList() {
        chatListUL.innerHTML = '';
        savedChats.sort((a, b) => (b.lastUpdated || b.createdAt || 0) - (a.lastUpdated || a.createdAt || 0)); // Sort by most recent activity
        savedChats.forEach(addChatToListUI);
        updateChatListActiveState();
    }

    function addChatToListUI(chat) {
        const listItem = document.createElement('li');
        listItem.dataset.chatId = chat.id;
        const chatName = chat.name || `Chat ${chat.id.substring(5, 10)}`; // More concise fallback
        listItem.title = chatName;

        const nameSpan = document.createElement('span');
        nameSpan.textContent = chatName;
        nameSpan.className = 'chat-name';

        const deleteButton = document.createElement('button');
        deleteButton.innerHTML = '<i class="fas fa-times"></i>';
        deleteButton.className = 'delete-chat-button';
        deleteButton.title = 'Delete Chat';
        deleteButton.onclick = (e) => handleDeleteChat(e, chat.id);

        listItem.appendChild(nameSpan);
        listItem.appendChild(deleteButton);

        listItem.onclick = () => handleSwitchChat(chat.id);

        chatListUL.appendChild(listItem);
    }

    function updateChatListActiveState() {
        const items = chatListUL.querySelectorAll('li');
        items.forEach(item => {
            item.classList.toggle('active', item.dataset.chatId === activeChatId);
        });
    }

     function updateChatListItemName(chatId, newName) {
        const nameSpan = chatListUL.querySelector(`li[data-chat-id="${chatId}"] .chat-name`);
        if (nameSpan && newName) {
            nameSpan.textContent = newName;
            nameSpan.parentElement.title = newName;
        }
    }

    // --- Model Fetching ---
    async function fetchAndPopulateModels() {
        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
            modelSelect.innerHTML = '<option value="">-- Enter API Key & Load --</option>';
            modelSelect.disabled = true;
            loadModelsButton.disabled = false;
            modelsLoaded = false;
            return;
        }

        setStatus('Loading LLM models...', 'working');
        modelSelect.disabled = true;
        loadModelsButton.disabled = true;
        modelSelect.innerHTML = '<option value="">-- Loading... --</option>';

        try {
            const response = await fetch(`${GROQ_API_BASE}/models`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                 const errorData = await response.json().catch(() => null);
                 const errorMsg = errorData?.error?.message || `HTTP error ${response.status}`;
                throw new Error(`Failed to fetch models: ${errorMsg}`);
            }

            const data = await response.json();
            const availableModels = data.data || [];

            const chatModels = availableModels.filter(model =>
                model.id && !model.id.includes('whisper') && !model.id.includes('tts') && !model.id.includes('guard') && model.id !== 'distil-whisper-large-v3-en' && (model.active === undefined || model.active === true)
            ).map(model => model.id);

            chatModels.sort();

            modelSelect.innerHTML = '';

            if (chatModels.length === 0) {
                modelSelect.innerHTML = '<option value="">-- No chat models found --</option>';
                setStatus('No compatible chat models found.', 'error');
                modelsLoaded = false;
            } else {
                let defaultSelected = false;
                chatModels.forEach(modelId => {
                    const option = document.createElement('option');
                    option.value = modelId;
                    option.textContent = modelId;
                    if (modelId === DEFAULT_CHAT_MODEL) {
                        option.selected = true; defaultSelected = true;
                    }
                    modelSelect.appendChild(option);
                });

                if (!defaultSelected && modelSelect.options.length > 0) {
                    modelSelect.options[0].selected = true;
                }
                modelSelect.disabled = false;
                setStatus('LLM models loaded.', 'info');
                modelsLoaded = true;
            }

        } catch (error) {
            console.error("Error fetching models:", error);
            setStatus(`Error loading models: ${error.message}`, 'error');
            modelSelect.innerHTML = '<option value="">-- Error loading --</option>';
            modelSelect.disabled = true;
            modelsLoaded = false;
        } finally {
             if (!modelsLoaded) loadModelsButton.disabled = false;
        }
    }


    // --- UI Helpers ---
    function addMessageToChat(sender, message, role) { // role is 'user', 'assistant', or 'error'
        const messageDiv = document.createElement('div');
        const senderClass = role === 'user' ? 'user' : (role === 'assistant' ? 'assistant' : 'error');
        messageDiv.classList.add('message', senderClass);

        const contentSpan = document.createElement('span');
        contentSpan.classList.add('content');
        contentSpan.textContent = message;

        messageDiv.appendChild(contentSpan);

        chatBox.appendChild(messageDiv);
        if (typeof chatBox.scrollTo === 'function') {
            chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
        } else {
            chatBox.scrollTop = chatBox.scrollHeight;
        }

        // Add to savedChats state (only user/assistant)
        if (activeChatId && (role === 'user' || role === 'assistant')) {
             let activeChat = savedChats.find(chat => chat.id === activeChatId);
             if (activeChat) {
                 if (!activeChat.messages) activeChat.messages = [];
                 activeChat.messages.push({ role: role, content: message });
             } else if (role === 'user') {
                // First user message for a new chat - state will be saved later
                 console.log("First user message for new chat ID:", activeChatId);
             }
        }
    }

    function setStatus(text, type = 'info') {
         statusElement.textContent = `Status: ${text}`;
         statusElement.className = '';
         if (type === 'working') statusElement.classList.add('status-working');
         else if (type === 'error') statusElement.classList.add('status-error');
     }
    function toggleSendCapability(disabled) {
        isProcessingSend = disabled;
        userInput.disabled = disabled;
        sendButton.disabled = disabled;
        if(!disabled && document.activeElement !== systemPromptInput && document.activeElement !== apiKeyInput ) {
             userInput.focus();
        }
    }
    function toggleSettingsPanel(show) {
        console.log(`Toggling settings panel. Show: ${show}`);
        if (!settingsPanel) { console.error("Settings panel element not found!"); return; }
        settingsPanel.classList.toggle('visible', show); // Simpler toggle
        console.log("Settings panel visibility:", settingsPanel.classList.contains('visible'));
        if (!show && apiKeyInput.value.trim() && !modelsLoaded) {
            console.log("Settings closed with key, attempting to load models.");
            fetchAndPopulateModels();
        }
    }
    function stopAndClearAudio() {
         if (currentAudio) {
            console.log("Stopping and clearing audio");
            currentAudio.pause();
             if (currentAudio.src && currentAudio.src.startsWith('blob:')) { URL.revokeObjectURL(currentAudio.src); }
             currentAudio.removeAttribute('src');
             currentAudio.load();
            currentAudio = null;
         }
    }
    function populateVoices() {
        AVAILABLE_ENGLISH_VOICES.forEach(voice => {
            const option = document.createElement('option');
            option.value = voice; option.textContent = voice.replace('-PlayAI', '');
            if (voice === DEFAULT_VOICE) option.selected = true;
            voiceSelect.appendChild(option);
        });
     }
    function updateSpeedDisplay() {
        const speed = parseFloat(speedSlider.value).toFixed(1);
        speedValueSpan.textContent = `${speed}x`;
        if (currentAudio && currentAudio.readyState >= 1) {
             try { currentAudio.playbackRate = speed; } catch (e) { console.warn("Could not set playbackRate:", e); }
        }
     }

    // --- Core Logic: Sending Message ---
    async function handleSendMessage() {
        const userText = userInput.value.trim();
        const apiKey = apiKeyInput.value.trim();
        const selectedModel = modelSelect.value;
        const currentSystemPrompt = systemPromptInput.value.trim() || DEFAULT_SYSTEM_PROMPT;

        // --- Validation ---
        if (!apiKey) { setStatus('API Key missing!', 'error'); addMessageToChat('Error','Please enter API Key in Settings.','error'); toggleSettingsPanel(true); apiKeyInput.focus(); return; }
        if (!modelsLoaded || !selectedModel) { setStatus('LLM Models not loaded/selected.', 'error'); addMessageToChat('Error','Load models (Settings) & select LLM.','error'); if(!modelsLoaded) toggleSettingsPanel(true); return; }
        if (!userText || isProcessingSend) { return; }
        if (!activeChatId) { console.error("No active chat ID set!"); handleNewChat(); } // Should not happen, but safeguard

        // --- Start ---
        toggleSendCapability(true);
        setStatus('Sending message...', 'working');
        addMessageToChat('You', userText, 'user');
        userInput.value = '';
        stopAndClearAudio();

        const currentMessages = getActiveChatMessages();
        const apiMessages = [ { role: "system", content: currentSystemPrompt }, ...currentMessages ];

        try {
            // 1. --- Chat Completion ---
            setStatus(`Generating response (${selectedModel})...`, 'working');

            // Prepare payload WITH current LLM parameters
            const chatPayload = {
                messages: apiMessages,
                model: selectedModel,
                temperature: currentLLMParams.temperature,
                max_completion_tokens: currentLLMParams.max_completion_tokens,
                top_p: currentLLMParams.top_p,
                frequency_penalty: currentLLMParams.frequency_penalty,
                presence_penalty: currentLLMParams.presence_penalty,
                stream: false
            };
            console.log("Sending Chat Payload:", chatPayload);

            const chatResponse = await fetch(`${GROQ_API_BASE}/chat/completions`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(chatPayload)
            });

            if (!chatResponse.ok) {
                const errorData = await chatResponse.json().catch(() => ({ error: { message: `HTTP error ${chatResponse.status}` } }));
                throw new Error(`Chat API Error (${chatResponse.status}): ${errorData.error?.message || 'Failed response'}`);
            }
            const chatData = await chatResponse.json();
            // Add usage info to status (optional)
            const usage = chatData.usage;
            let usageText = '';
            if(usage) {
                usageText = ` (${usage.completion_tokens} tokens / ${usage.total_time?.toFixed(2)}s)`;
            }

            const assistantMessage = chatData.choices[0]?.message?.content;
            if (!assistantMessage) { throw new Error('Empty response from assistant.'); }

            addMessageToChat('Assistant', assistantMessage, 'assistant');
            saveCurrentChatState(); // Save AFTER successful response

            // 2. --- Text-to-Speech ---
            setStatus(`Generating speech...${usageText}`, 'working'); // Include usage in status
            const selectedVoice = voiceSelect.value;
            const ttsPayload = { model: TTS_MODEL, voice: selectedVoice, input: assistantMessage, response_format: "wav" };
            const ttsResponse = await fetch(`${GROQ_API_BASE}/audio/speech`, {
                 method: 'POST',
                 headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                 body: JSON.stringify(ttsPayload)
            });
            if (!ttsResponse.ok) {
                 const errorData = await ttsResponse.json().catch(() => ({ error: { message: `HTTP error ${ttsResponse.status}` } }));
                throw new Error(`TTS API Error (${ttsResponse.status}): ${errorData.error?.message || 'Failed audio gen'}`);
            }
            const audioBlob = await ttsResponse.blob();

            // 3. --- Play Audio ---
            setStatus(`Speaking...${usageText}`, 'working');
            const audioUrl = URL.createObjectURL(audioBlob);
            audioPlayer.src = audioUrl;
            try { audioPlayer.playbackRate = parseFloat(speedSlider.value); } catch(e) { console.warn("Playback rate set failed", e); audioPlayer.playbackRate = 1.0;}
            currentAudio = audioPlayer;

            // Define audio event handlers (will re-enable send capability)
            audioPlayer.onerror = (e) => {
                 console.error("Audio player error:", e.target.error);
                 setStatus(`Audio player error.${usageText}`, 'error');
                 addMessageToChat('Error', `Audio playback error: ${e.target.error?.message || 'Unknown'}`, 'error');
                 toggleSendCapability(false); stopAndClearAudio();
            };
            audioPlayer.onended = () => {
                 setStatus(`Ready.${usageText}`);
                 toggleSendCapability(false); stopAndClearAudio();
            };

            // Play
            const playPromise = audioPlayer.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.error("Audio playback failed:", error);
                    setStatus(`Playback failed. Click page?${usageText}`, 'error');
                    addMessageToChat('Error', `Playback failed: ${error.message}`, 'error');
                    toggleSendCapability(false); stopAndClearAudio();
                });
            }

        // --- Error Handling ---
        } catch (error) {
            console.error("Processing Error:", error);
            setStatus(`Error: ${error.message}`, 'error');
            addMessageToChat('Error', error.message, 'error');
            toggleSendCapability(false);
            stopAndClearAudio();
        }
    }


    // --- Utility Functions ---
    function generateChatId() {
        return `chat_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    function generateChatName(messages) {
         const firstUserMsgContent = messages?.find(m => m.role === 'user')?.content;
         if (firstUserMsgContent) {
             // Take first few words, limit length
             return firstUserMsgContent.split(' ').slice(0, 6).join(' ').substring(0, 40) || "Chat";
         }
         // Fallback name if no user messages yet
         const now = new Date();
         return `Chat ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }

    // --- Event Listeners Setup ---
    function setupEventListeners() {
        console.log("Setting up event listeners...");

        // Verify elements and add listeners
        if (sendButton) sendButton.addEventListener('click', handleSendMessage); else console.error("Send button not found");
        if (userInput) userInput.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); handleSendMessage(); } }); else console.error("User input not found");
        if (settingsButton) settingsButton.addEventListener('click', () => { const isVisible = settingsPanel?.classList.contains('visible'); toggleSettingsPanel(!isVisible); }); else console.error("Settings button not found!");
        if (closeSettingsButton) closeSettingsButton.addEventListener('click', () => toggleSettingsPanel(false)); else console.error("Close settings button not found");
        if (loadModelsButton) loadModelsButton.addEventListener('click', fetchAndPopulateModels); else console.error("Load models button not found");
        if (newChatButton) newChatButton.addEventListener('click', handleNewChat); else console.error("New chat button not found");
        if (speedSlider) speedSlider.addEventListener('input', updateSpeedDisplay); else console.error("Speed slider not found");
        if (systemPromptInput) systemPromptInput.addEventListener('input', saveCurrentChatState); else console.error("System prompt input not found"); // Save on input for real-time feel

        // LLM Parameter Listeners
        const paramInputs = [ paramTemperatureSlider, paramMaxTokensInput, paramTopPSlider, paramFreqPenaltySlider, paramPresPenaltySlider ];
        paramInputs.forEach(input => {
            if (input) {
                input.addEventListener('input', handleParamChange);
                 if(input.type === 'number') input.addEventListener('change', handleParamChange); // Also listen for change on number input
            } else { console.error(`Parameter input element not found.`); }
        });

        // Outside click listener for settings panel
        document.addEventListener('click', (event) => {
            if (settingsPanel && settingsButton && settingsPanel.classList.contains('visible')) {
                if (!settingsPanel.contains(event.target) && event.target !== settingsButton && !settingsButton.contains(event.target)) {
                    toggleSettingsPanel(false);
                }
            }
        });

         console.log("Event listeners setup complete.");
    }

    // --- Run Initialization ---
    initializeApp(); // Start the application

}); // End DOMContentLoaded