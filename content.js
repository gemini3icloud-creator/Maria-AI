// Maria AI - Content Script con Shadow DOM

(function () {
    // 1. Check for Duplicate Injection
    if (window.hasMariaAI) {
        console.log("Maria AI already injected.");
        const existingHost = document.getElementById('maria-ai-host');
        // If it exists but is hidden, we might want to toggle it.
        // But since we can't easily reach the original scope's toggleUI, 
        // we assume the background script handles the toggle message which the ORIGINAL script receives.
        // So we just exit to avoid duplicate listeners and variable collisions.
        return;
    }
    window.hasMariaAI = true;

    let shadowRoot = null;
    let overlayContainer = null;
    let isOpen = false;
    let recognition = null;
    let synthesis = window.speechSynthesis;

    // Iconos SVG (Minimalist / Tech)
    const ICONS = {
        send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>',
        mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>',
        close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
        camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>',
        attach: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>',
        speaker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>',
        stop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>',
        minimize: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="12" x2="23" y2="12"></line></svg>',
        expand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>',
        video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>',
        youtube: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z"></path><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon></svg>'
    };

    // Tiny Sanitizer to avoid heavy libraries for now
    function sanitizeHTML(html) {
        if (!html) return "";
        return html
            .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
            .replace(/on\w+="[^"]*"/g, "")
            .replace(/on\w+='[^']*'/g, "")
            .replace(/javascript:/g, "no-js:");
    }

    async function initMaria() {
        const existingHost = document.getElementById('maria-ai-host');
        if (existingHost) {
            existingHost.remove();
        }

        // 1. Crear Host y Shadow DOM
        const host = document.createElement('div');
        host.id = 'maria-ai-host';
        host.style.position = 'fixed';
        host.style.zIndex = '2147483647';
        host.style.top = '0';
        host.style.right = '0';
        document.body.appendChild(host);

        shadowRoot = host.attachShadow({ mode: 'open' });

        // 2. Cargar Estilos
        // Inyectar GLOBAL styles para drag & drop fix (iframes)
        if (!document.getElementById('maria-global-styles')) {
            const globalStyle = document.createElement('style');
            globalStyle.id = 'maria-global-styles';
            globalStyle.textContent = `body.maria-dragging iframe { pointer-events: none !important; }`;
            document.head.appendChild(globalStyle);
        }

        const styleLink = document.createElement('link');
        styleLink.rel = 'stylesheet';
        styleLink.href = chrome.runtime.getURL('styles.css');
        shadowRoot.appendChild(styleLink);

        // 3. Estructura HTML
        const container = document.createElement('div');
        container.id = 'maria-overlay';

        const iconUrl = chrome.runtime.getURL('assets/icon.png');

        container.innerHTML = `
            <div class="sidebar">
                <div class="shortcut" data-url="https://chatgpt.com/" title="ChatGPT" style="background-image: url('${chrome.runtime.getURL('assets/openai.png')}')"></div>
                <div class="shortcut" data-url="https://gemini.google.com/" title="Gemini" style="background-image: url('${chrome.runtime.getURL('assets/gemini-color.png')}')"></div>
                <div class="shortcut" data-url="https://claude.ai/" title="Claude" style="background-image: url('${chrome.runtime.getURL('assets/claude-color.png')}')"></div>
                <div class="shortcut" data-url="https://copilot.microsoft.com/" title="Copilot" style="background-image: url('${chrome.runtime.getURL('assets/copilot-color.png')}')"></div>
                <div class="shortcut" data-url="https://chat.deepseek.com/" title="DeepSeek" style="background-image: url('${chrome.runtime.getURL('assets/deepseek-color.png')}')"></div>
                <div class="shortcut" data-url="https://x.com/i/grok" title="Grok" style="background-image: url('${chrome.runtime.getURL('assets/grok.png')}')"></div>
            </div>
            
            <div class="main-content">
                <div class="hero-header">
                    <div class="hero-avatar" id="maria-avatar">
                       <img src="${iconUrl}" alt="Maria">
                    </div>
                    <div class="hero-info">
                        <h2>MARIA AI</h2>
                        <span class="status-badge" id="status-badge">ONLINE</span>
                    </div>
                    <button id="minimize-btn" class="window-ctrl-btn" title="Minimizar">${ICONS.minimize}</button>
                    <button id="close-btn" class="window-ctrl-btn" title="Cerrar">${ICONS.close}</button>
                </div>

                <div class="chat-area" id="chat-feed">
                    <div class="message model">
                        <div class="bubble">Hola, soy Maria. ¿En qué te ayudo hoy? ✨</div>
                    </div>
                </div>

                <div class="input-area">
                    <div class="input-controls">
                         <button class="tool-btn" id="btn-screen" title="Analizar Pantalla">${ICONS.camera}</button>
                         <button class="tool-btn" id="btn-video" title="Analizar Video">${ICONS.video}</button>
                         <button class="tool-btn" id="btn-youtube" title="Analizar YouTube">${ICONS.youtube}</button>
                         <label class="tool-btn" id="btn-file" title="Adjuntar archivo">
                            ${ICONS.attach}
                            <input type="file" hidden id="file-input">
                        </label>
                        <input type="file" hidden id="video-input" accept="video/*">
                         <button id="mic-btn" class="mic-btn-large" title="Hablar con Maria">${ICONS.mic}</button>
                    </div>
                    <div class="input-wrapper">
                        <textarea id="prompt-input" rows="1" placeholder="Escribe aquí..."></textarea>
                        <button id="send-btn" class="icon-btn primary">${ICONS.send}</button>
                    </div>
                </div>
            </div>
        `;

        shadowRoot.appendChild(container);
        overlayContainer = container;

        bindEvents();

        requestAnimationFrame(() => {
            container.classList.add('visible');
            isOpen = true;
        });

        makeDraggable(container);
    }

    function bindEvents() {
        const q = (sel) => shadowRoot.querySelector(sel);

        q('#close-btn').onclick = toggleUI;

        q('#minimize-btn').onclick = (e) => {
            e.stopPropagation();
            toggleMinimize();
        };

        overlayContainer.onclick = (e) => {
            if (overlayContainer.getAttribute('data-just-dragged') === 'true') {
                return;
            }
            if (overlayContainer.classList.contains('minimized')) {
                toggleMinimize();
            }
        };

        q('.main-content').onclick = (e) => {
            if (!overlayContainer.classList.contains('minimized')) {
                e.stopPropagation();
            }
        };

        let pendingFileAttachment = null;

        const send = () => {
            const input = q('#prompt-input');
            const text = input.value.trim();

            if (!text && !pendingFileAttachment) return;

            addMessage(text, 'user');
            setLoading(true);

            let fullText = text;
            if (pendingFileAttachment) {
                if (pendingFileAttachment.type === 'video') {
                    // Handled separately below, but we consume the pending attachment
                } else {
                    fullText += `\n\n[Contenido de ${pendingFileAttachment.name}]:\n\`\`\`\n${pendingFileAttachment.content}\n\`\`\``;
                }
            }

            input.value = '';
            input.style.height = 'auto';

            const attachment = pendingFileAttachment; // Copy reference
            pendingFileAttachment = null; // Reset

            if (attachment && attachment.type === 'video') {
                // Send Video Analysis Request
                safelySendMessage({
                    action: 'analyzeVideo',
                    text: text,
                    videoData: attachment.content, // DataURL
                    mimeType: attachment.mimeType
                }, handleResponse);
            } else {
                // Standard Text/Code Request
                safelySendMessage({ action: 'generateContent', type: 'text', text: fullText }, handleResponse);
            }
        };

        q('#send-btn').onclick = send;
        q('#prompt-input').onkeydown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
            }
            e.stopPropagation();
        };

        q('#prompt-input').oninput = function () {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
        };

        ['keydown', 'keypress', 'keyup'].forEach(eventType => {
            q('#prompt-input').addEventListener(eventType, (e) => {
                e.stopPropagation();
                e.stopImmediatePropagation();
            });
        });

        q('#btn-screen').onclick = () => {
            addMessage("Analizando pantalla actual...", 'user');

            // Clean Screenshot: Hide UI and wait for transition end
            if (isOpen) {
                const onHidden = () => {
                    overlayContainer.removeEventListener('transitionend', onHidden);
                    setTimeout(() => { // Small buffer after transition
                        setLoading(true);
                        safelySendMessage({ action: 'analyzeScreen' }, handleResponse);
                    }, 50);
                };
                overlayContainer.addEventListener('transitionend', onHidden);
                toggleUI();
            } else {
                setLoading(true);
                safelySendMessage({ action: 'analyzeScreen' }, handleResponse);
            }
        };

        q('#btn-video').onclick = () => {
            q('#video-input').click();
        };

        q('#btn-youtube').onclick = () => {
            const videoId = new URLSearchParams(window.location.search).get('v');
            if (!videoId) {
                addMessage("⚠️ No se detectó un video de YouTube activo.", 'model', true);
                return;
            }

            // Scrape Metadata
            const videoElement = document.querySelector('video');
            const currentTimestamp = videoElement ? videoElement.currentTime : 0;
            const videoTitle = document.title.replace(' - YouTube', '');
            const videoDescription = document.querySelector('meta[name="description"]')?.content || "";

            // Format time
            const formatTime = (s) => {
                const date = new Date(0);
                date.setSeconds(s);
                return date.toISOString().substr(11, 8);
            };

            addMessage(`🎬 Analizando video de YouTube (${formatTime(currentTimestamp)})...`, 'user');
            setLoading(true);

            safelySendMessage({
                action: 'analyzeYoutube',
                videoId: videoId,
                videoTitle: videoTitle,
                videoDescription: videoDescription,
                currentTimestamp: formatTime(currentTimestamp)
            }, handleResponse);
        };

        q('#video-input').onchange = (e) => {
            handleFileSelect(e.target.files[0], true);
            e.target.value = ''; // Reset input to allow re-selecting same file
        };

        q('.sidebar').onclick = (e) => {
            const url = e.target.getAttribute('data-url');
            if (url) window.open(url, '_blank');
        };

        q('#file-input').onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            handleFileSelect(file, false);
            e.target.value = '';
        };

        function handleFileSelect(file, forcedVideo = false) {
            if (!file) return;

            const allowedTypes = ['text/plain', 'text/javascript', 'text/html', 'text/css', 'application/json', 'text/markdown', 'text/x-python', 'application/javascript', 'video/mp4', 'video/webm', 'video/quicktime'];
            const allowedExtensions = /\.(js|py|txt|md|json|html|css|ts|jsx|tsx|java|c|cpp|cs|rb|php|xml|yaml|yml|sh|bat|mp4|webm|mov)$/i;

            if (!allowedTypes.includes(file.type) && !allowedExtensions.test(file.name)) {
                addMessage("⚠️ Formato de archivo no soportado. Por favor sube archivos de código, texto o video.", 'model', true);
                return;
            }

            // Check size (max 20MB for inline video API)
            const MAX_SIZE = 20 * 1024 * 1024;
            if (file.type.startsWith('video/') && file.size > MAX_SIZE) {
                addMessage("⚠️ El video es demasiado grande (Máx 20MB).", 'model', true);
                return;
            }

            const isVideo = file.type.startsWith('video/');
            // Validation if user manually picked a non-video via video button (rare in file picker but possible)
            if (forcedVideo && !isVideo) {
                addMessage("⚠️ Por favor selecciona un archivo de video.", 'model', true);
                return;
            }
            const reader = new FileReader();

            reader.onload = (e) => {
                const content = e.target.result;
                const input = q('#prompt-input');

                pendingFileAttachment = {
                    name: file.name,
                    content: content, // This is text content OR DataURL for video
                    type: isVideo ? 'video' : 'text',
                    mimeType: file.type
                };

                const visualTag = ` [${isVideo ? 'Video' : 'Archivo'}: ${file.name}] `;
                input.value += visualTag;

                input.style.height = 'auto';
                input.style.height = (input.scrollHeight) + 'px';

                input.style.height = 'auto';
                input.style.height = (input.scrollHeight) + 'px';
            };
            if (isVideo) {
                reader.readAsDataURL(file);
            } else {
                reader.readAsText(file);
            }
        }

        q('#mic-btn').onclick = () => {
            if (!recognition) setupRecognition(q);
            if (recognition && recognition.started) recognition.stop();
            else if (recognition) recognition.start();
        };
    }

    function setupRecognition(q) {
        const SpeechRecognition = window.webkitSpeechRecognition;
        if (!SpeechRecognition) return alert("Tu navegador no soporta voz.");

        recognition = new SpeechRecognition();
        recognition.lang = 'es-ES';
        recognition.continuous = false;

        recognition.onstart = () => {
            recognition.started = true;
            q('#mic-btn').classList.add('recording');
            q('#mic-btn').innerHTML = ICONS.stop;
        };
        recognition.onend = () => {
            recognition.started = false;
            q('#mic-btn').classList.remove('recording');
            q('#mic-btn').innerHTML = ICONS.mic;
        };
        recognition.onresult = (e) => {
            const text = e.results[0][0].transcript;
            q('#prompt-input').value += text;
        };
    }

    function setLoading(isLoading) {
        const avatar = shadowRoot?.querySelector('#maria-avatar');
        const badge = shadowRoot?.querySelector('#status-badge');

        if (avatar) {
            if (isLoading) {
                avatar.classList.add('loading');
                if (badge) {
                    badge.textContent = "PENSANDO...";
                    badge.style.color = "#00F2FF";
                    badge.style.borderColor = "rgba(0, 242, 255, 0.3)";
                }
            } else {
                avatar.classList.remove('loading');
                if (badge) {
                    badge.textContent = "ONLINE";
                    badge.style.color = "#00ff88";
                    badge.style.borderColor = "rgba(0, 255, 136, 0.3)";
                }
            }
        }
    }

    function handleResponse(response) {
        if (!isOpen) toggleUI();
        setLoading(false);

        if (response && response.error) {
            addMessage("Error: " + response.error, 'model', true);
        } else if (response && response.text) {
            addMessage(response.text, 'model');
        } else {
            // If we are using streaming, we might not get a final 'text' block but stream chunks.
            // But if we do get here for non-streamed logic (like tools), addMessage works.
        }
    }

    // Listen for stream chunks from background
    chrome.runtime.onMessage.addListener((req) => {
        if (req.action === 'streamChunk') {
            if (!isOpen) toggleUI();
            setLoading(false);

            // If badge is error, reset to online during stream
            const badge = shadowRoot?.querySelector('#status-badge');
            if (badge && badge.textContent !== "ONLINE") {
                badge.textContent = "ONLINE";
                badge.style.color = "#00ff88"; // Reset
            }

            appendStreamMessage(req.chunk);
        }
        if (req.action === 'streamDone') {
            finalizeStreamMessage();
        }
        if (req.action === 'streamError') {
            setLoading(false);
            addMessage("Error en stream: " + req.error, 'model', true);

            // Visual Error
            const badge = shadowRoot?.querySelector('#status-badge');
            if (badge) {
                badge.textContent = "ERROR";
                badge.style.color = "#ff4444";
                badge.style.borderColor = "rgba(255, 68, 68, 0.3)";
            }
        }

        if (req.action === 'toggle') toggleUI();
        if (req.action === 'captureDone') {
            if (!isOpen) toggleUI();
        }
    });

    let currentStreamMsg = null;
    let currentStreamText = "";

    function appendStreamMessage(chunk) {
        const feed = shadowRoot?.querySelector('#chat-feed');
        if (!feed) return;

        if (!currentStreamMsg) {
            currentStreamMsg = document.createElement('div');
            currentStreamMsg.className = 'message model';
            currentStreamMsg.innerHTML = `<div class="bubble"></div>`;
            feed.appendChild(currentStreamMsg);
        }

        currentStreamText += chunk;
        const bubble = currentStreamMsg.querySelector('.bubble');

        let html;
        if (typeof marked !== 'undefined' && marked.parse) {
            html = sanitizeHTML(marked.parse(currentStreamText));
        } else {
            html = currentStreamText.replace(/\n/g, '<br>');
        }

        bubble.innerHTML = html;
        feed.scrollTo({ top: feed.scrollHeight, behavior: 'smooth' });
    }

    function finalizeStreamMessage() {
        if (currentStreamMsg) {
            const feed = shadowRoot?.querySelector('#chat-feed');
            if (feed) {
                // Process code blocks for the finished message
                const codeBlocks = currentStreamMsg.querySelectorAll('pre code');
                codeBlocks.forEach(codeBlock => {
                    if (codeBlock.parentNode.previousElementSibling?.className === 'code-wrapper') return;

                    const pre = codeBlock.parentNode;
                    const wrapper = document.createElement('div');
                    wrapper.className = 'code-wrapper';
                    pre.parentNode.insertBefore(wrapper, pre);

                    const header = document.createElement('div');
                    header.className = 'code-header';
                    const lang = codeBlock.className.replace('language-', '') || 'code';
                    header.innerHTML = `<span>${lang}</span>`;

                    const copyBtn = document.createElement('button');
                    copyBtn.className = 'copy-btn';
                    copyBtn.textContent = 'Copiar';
                    copyBtn.onclick = () => {
                        navigator.clipboard.writeText(codeBlock.innerText).then(() => {
                            copyBtn.textContent = '¡Copiado!';
                            setTimeout(() => copyBtn.textContent = 'Copiar', 2000);
                        });
                    };
                    header.appendChild(copyBtn);
                    wrapper.appendChild(header);
                    wrapper.appendChild(pre);
                });
            }
            currentStreamMsg = null;
            currentStreamText = "";
        }
    }

    function addMessage(text, sender, isError = false) {
        const feed = shadowRoot.querySelector('#chat-feed');
        const msg = document.createElement('div');
        msg.className = `message ${sender}`;

        let html;
        try {
            if (typeof marked !== 'undefined' && marked.parse) {
                html = sanitizeHTML(marked.parse(text));
            } else {
                html = text.replace(/\n/g, '<br>');
            }
        } catch (e) {
            html = text.replace(/\n/g, '<br>');
        }

        msg.innerHTML = `<div class="bubble ${isError ? 'error' : ''}">${html}</div>`;

        const codeBlocks = msg.querySelectorAll('pre code');
        codeBlocks.forEach(codeBlock => {
            const pre = codeBlock.parentNode;
            const wrapper = document.createElement('div');
            wrapper.className = 'code-wrapper';
            pre.parentNode.insertBefore(wrapper, pre);

            const header = document.createElement('div');
            header.className = 'code-header';
            const lang = codeBlock.className.replace('language-', '') || 'code';
            header.innerHTML = `<span>${lang}</span>`;

            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-btn';
            copyBtn.textContent = 'Copiar';
            copyBtn.onclick = () => {
                navigator.clipboard.writeText(codeBlock.innerText).then(() => {
                    copyBtn.textContent = '¡Copiado!';
                    setTimeout(() => copyBtn.textContent = 'Copiar', 2000);
                });
            };

            header.appendChild(copyBtn);
            wrapper.appendChild(header);
            wrapper.appendChild(pre);
        });

        if (sender === 'model' && !isError) {
            const actions = document.createElement('div');
            actions.wrapper = 'msg-actions'; // Fix className typo? No, property is not wrapper.
            actions.className = 'msg-actions'; // Fix

            const btn = document.createElement('button');
            btn.innerHTML = ICONS.speaker;
            btn.className = 'speak-btn';
            btn.title = 'Escuchar';
            btn.onclick = () => speakMessage(text);

            actions.appendChild(btn);
            msg.appendChild(actions);
        }

        feed.appendChild(msg);
        feed.scrollTo({ top: feed.scrollHeight, behavior: 'smooth' });
    }

    function speakMessage(text) {
        if (synthesis.speaking) {
            synthesis.cancel();
        }
        const cleanText = text.replace(/[*`_]/g, '');
        const utterance = new SpeechSynthesisUtterance(cleanText);
        const voices = synthesis.getVoices();
        const preferredVoice = voices.find(v => v.lang.startsWith('es') && (v.name.includes('Google') || v.name.includes('Helena')));
        if (preferredVoice) utterance.voice = preferredVoice;
        utterance.pitch = 1.2;
        utterance.rate = 1.1;
        synthesis.speak(utterance);
    }

    function toggleUI() {
        const container = shadowRoot?.querySelector('#maria-overlay');
        if (!container) {
            initMaria();
        } else {
            if (isOpen) {
                container.classList.remove('visible');
                isOpen = false;
            } else {
                container.classList.add('visible');
                isOpen = true;
                const feed = shadowRoot?.querySelector('#chat-feed');
                if (feed) feed.scrollTo({ top: feed.scrollHeight, behavior: 'smooth' });

                // Check YouTube visibility

            }
        }
    }

    function toggleMinimize() {
        const container = shadowRoot?.querySelector('#maria-overlay');
        if (!container) return;

        container.classList.toggle('minimized');
        container.style.width = '';
        container.style.height = '';
    }

    function makeDraggable(element) {
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;
        let hasMoved = false;

        const onMouseDown = (e) => {
            const isMinimized = element.classList.contains('minimized');
            const target = e.composedPath()[0];

            if (!isMinimized) {
                const header = element.querySelector('.hero-header');
                if (!header.contains(target)) return;
                if (target.closest('button') || target.closest('.window-ctrl-btn')) return;
            }

            isDragging = true;
            hasMoved = false;

            const rect = element.getBoundingClientRect();
            startX = e.clientX;
            startY = e.clientY;
            initialLeft = rect.left;
            initialTop = rect.top;

            element.style.right = 'auto';
            element.style.bottom = 'auto';
            element.style.left = `${initialLeft}px`;
            element.style.top = `${initialTop}px`;

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);

            e.preventDefault();
        };

        const onMouseMove = (e) => {
            if (!isDragging) return;

            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                hasMoved = true;
                element.setAttribute('data-dragging', 'true');
            }

            let newLeft = initialLeft + dx;
            let newTop = initialTop + dy;

            const winWidth = window.innerWidth;
            const winHeight = window.innerHeight;
            const rect = element.getBoundingClientRect();

            if (newLeft < 0) newLeft = 0;
            if (newTop < 0) newTop = 0;
            if (newLeft + rect.width > winWidth) newLeft = winWidth - rect.width;
            if (newTop + rect.height > winHeight) newTop = winHeight - rect.height;

            element.style.left = `${newLeft}px`;
            element.style.top = `${newTop}px`;
        };

        const onMouseUp = (e) => {
            isDragging = false;
            document.body.classList.remove('maria-dragging');

            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);

            if (hasMoved) {
                element.removeAttribute('data-dragging');
                element.setAttribute('data-just-dragged', 'true');
                setTimeout(() => {
                    element.removeAttribute('data-just-dragged');
                }, 300);

                e.preventDefault();
                e.stopPropagation();
            }
        };

        element.addEventListener('mousedown', (e) => {
            const isMinimized = element.classList.contains('minimized');
            const target = e.composedPath()[0];

            if (!isMinimized) {
                const header = element.querySelector('.hero-header');
                if (!header.contains(target)) return;
                if (target.closest('button') || target.closest('.window-ctrl-btn')) return;
            }

            onMouseDown(e);
            if (isDragging) {
                document.body.classList.add('maria-dragging');
            }
        });
    }

    function safelySendMessage(message, callback) {
        try {
            chrome.runtime.sendMessage(message, (response) => {
                const lastError = chrome.runtime.lastError;
                if (lastError) {
                    if (lastError.message.includes("Extension context invalidated")) {
                        setLoading(false);
                        addMessage("⛔ <b>Conexión perdida</b><br>La extensión se ha actualizado. Por favor, recarga esta página para reconectar.", 'model', true);
                    } else {
                        if (callback) callback({ error: lastError.message });
                    }
                } else {
                    if (callback) callback(response);
                }
            });
        } catch (error) {
            if (error.message.includes("Extension context invalidated")) {
                setLoading(false);
                addMessage("⛔ <b>Conexión perdida</b><br>La extensión se ha actualizado. Por favor, recarga esta página para reconectar.", 'model', true);
            } else {
                console.error("Maria AI Error:", error);
                if (callback) callback({ error: error.message });
            }
        }
    }

})();
