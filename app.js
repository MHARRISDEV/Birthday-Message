/**
 * Animated Birthday Experience
 * Core Application Logic & Audio Synthesis Engine
 */

// Global State Object
const appState = {
    currentView: 'qr',
    virtualTimeOffset: 0, // Used for demo overrides
    isDemoMode: false,
    webhookUrl: localStorage.getItem('birthday_webhook') || '',
    passcode: localStorage.getItem('birthday_passcode') || '0503',
    cakeStage: 0, // 0: base, 1: candles placed, 2: lit, 3: blown out
    enteredCode: '',
    comments: JSON.parse(localStorage.getItem('birthday_comments')) || {
        1: ["Such a lovely day! 💕"],
        2: ["Best coffee chat ever. ☕"],
        3: ["We definitely need to go back there! ⛰"],
        4: ["Warm blankets and movie marathons 🍿"]
    },
    qrScannerInstance: null
};

const memoriesData = {
    1: { title: "Where It All Started", tag: "The Beginning 📍", image: "assets/memory1.jpg",
         desc: "..." },
    2: { title: "Late Night Conversations", tag: "Shared Giggles ☕", image: "assets/memory2.jpg",
         desc: "..." },
    3: { title: "Escapes & Wanderlust", tag: "Adventures 🎒", image: "assets/memory3.jpg",
         desc: "..." },
    4: { title: "Comfort & Warmth", tag: "Cozy Times 🍿", image: "assets/memory4.jpg",
         desc: "..." },
    5: { title: "Your New Title", tag: "Your Tag Here", image: "assets/memory5.jpg",
         desc: "Your description here." },
    6: { title: "Your New Title", tag: "Your Tag Here", image: "assets/memory6.jpg",
         desc: "Your description here." },
    7: { title: "Your New Title", tag: "Your Tag Here", image: "assets/memory7.jpg",
         desc: "Your description here." },
    8: { title: "Your New Title", tag: "Your Tag Here", image: "assets/memory8.jpg",
         desc: "Your description here." },
    9: { title: "Your New Title", tag: "Your Tag Here", image: "assets/memory9.jpg",
         desc: "Your description here." }
};

// ==========================================================================
// WEB AUDIO SYNTHESIZER ENGINE (Procedural Audio)
// ==========================================================================
const audioSynth = {
    ctx: null,

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },

    playHeartbeat() {
        this.init();
        const now = this.ctx.currentTime;
        
        // Double beat: lub-dub
        this.beat(now, 80, 0.12);
        this.beat(now + 0.25, 70, 0.12);
    },

    beat(time, startFreq, duration) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.frequency.setValueAtTime(startFreq, time);
        osc.frequency.exponentialRampToValueAtTime(10, time + duration);
        
        gain.gain.setValueAtTime(0.6, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + duration);
        
        osc.start(time);
        osc.stop(time + duration);
    },

    playChime() {
        this.init();
        const now = this.ctx.currentTime;
        const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 arpeggio
        
        freqs.forEach((freq, index) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.type = 'sine';
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            
            osc.frequency.setValueAtTime(freq, now + index * 0.12);
            
            gain.gain.setValueAtTime(0.2, now + index * 0.12);
            gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.12 + 0.6);
            
            osc.start(now + index * 0.12);
            osc.stop(now + index * 0.12 + 0.6);
        });
    },

    playSwoosh() {
        this.init();
        const now = this.ctx.currentTime;
        const duration = 0.8;
        
        // Generate white noise buffer
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        
        // Dynamic lowpass filter to make it sound like a breath/blow
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, now);
        filter.frequency.exponentialRampToValueAtTime(100, now + duration);
        
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        
        noise.start(now);
        noise.stop(now + duration);
    },

    playCelebration() {
        this.init();
        const now = this.ctx.currentTime;
        
        // Fast succession of random happy beeps
        for (let i = 0; i < 8; i++) {
            const timeOffset = i * 0.15;
            const freq = 600 + Math.random() * 800;
            
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.type = 'triangle';
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            
            osc.frequency.setValueAtTime(freq, now + timeOffset);
            
            gain.gain.setValueAtTime(0.15, now + timeOffset);
            gain.gain.exponentialRampToValueAtTime(0.001, now + timeOffset + 0.4);
            
            osc.start(now + timeOffset);
            osc.stop(now + timeOffset + 0.4);
        }
    }
};

// ==========================================================================
// STATE & VIEW MANAGER
// ==========================================================================
appState.transitionTo = function(viewId) {
    const currentActive = document.querySelector('.view.active');
    const targetView = document.getElementById(`view-${viewId}`);
    
    if (!targetView) return;
    
    // Stop QR scanner if active
    if (this.currentView === 'qr' && this.qrScannerInstance) {
        try {
            this.qrScannerInstance.stop();
        } catch(e) {}
        document.querySelector('.scanner-overlay').classList.remove('hidden');
    }
    
    // Switch Active Classes
    if (currentActive) {
        currentActive.classList.remove('active');
    }
    
    targetView.classList.add('active');
    this.currentView = viewId;
    
    // Trigger view-specific entry actions
    switch(viewId) {
        case 'matrix':
            matrixRain.start();
            break;
        case 'countdown':
            countdownTimer.start();
            break;
        case 'cake':
            cakeExperience.reset();
            break;
        case 'wish':
            birthdayWish.triggerTyping();
            break;
        case 'memories':
            memoriesGallery.loadComments();
            break;
    }
    
    showToast(`Navigated to Phase: ${viewId.toUpperCase()}`);
};

// ==========================================================================
// STEP 1: QR CODE VERIFICATION & BYPASS
// ==========================================================================
const qrCodeController = {
    init() {
        const fileInput = document.getElementById('qr-file-input');
        const cameraBtn = document.getElementById('btn-start-camera');
        const bypassBtn = document.getElementById('btn-simulate-scan');

        // URL Check
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('code') === 'BIRTHDAY_2026' || urlParams.get('payload') === 'love') {
            setTimeout(() => {
                showToast("Decrypted payload from URL!", "success");
                appState.transitionTo('matrix');
            }, 800);
        }

        // File Uploader
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const html5QrCode = new Html5Qrcode("qr-reader");
            html5QrCode.scanFile(file, true)
                .then(decodedText => {
                    this.onSuccess(decodedText);
                })
                .catch(err => {
                    showToast("No valid verification code found in image.", "error");
                    console.error("QR Scan Error:", err);
                });
        });

        // Camera Activation
        cameraBtn.addEventListener('click', () => {
            audioSynth.init();
            document.querySelector('.scanner-overlay').classList.add('hidden');
            
            const html5QrCode = new Html5Qrcode("qr-reader");
            appState.qrScannerInstance = html5QrCode;
            
            const config = { fps: 10, qrbox: { width: 200, height: 200 } };
            
            html5QrCode.start(
                { facingMode: "environment" }, 
                config, 
                (decodedText) => {
                    this.onSuccess(decodedText);
                },
                (errorMessage) => {
                    // Verbose failures can be ignored
                }
            ).catch(err => {
                showToast("Unable to access camera. Please upload file or use Bypass.", "error");
                document.querySelector('.scanner-overlay').classList.remove('hidden');
            });
        });

        // Simulation/Bypass Button
        bypassBtn.addEventListener('click', () => {
            audioSynth.playChime();
            showToast("Bypassing scanner... Decoding encryption", "success");
            setTimeout(() => {
                appState.transitionTo('matrix');
            }, 1000);
        });
    },

    onSuccess(payload) {
        audioSynth.playChime();
        showToast("System Security Decrypted!", "success");
        if (appState.qrScannerInstance) {
            appState.qrScannerInstance.stop();
        }
        setTimeout(() => {
            appState.transitionTo('matrix');
        }, 800);
    }
};

// ==========================================================================
// STEP 2: PINK MATRIX FALL ENGINE
// ==========================================================================
const matrixRain = {
    canvas: null,
    ctx: null,
    animationFrameId: null,
    columns: [],
    fontSize: 14,
    chars: "🌸💗01010011011110010111001101110100011001010110110101001100011011110111011001100101", // glitch letters, binary, and symbols
    progress: 0,
    logs: [
        "INITIALIZING BIRTHDAY SECURE PROTOCOL...",
        "CONNECTING TARGET DECRYPTION BUFFER...",
        "LOAD SYSTEM DEFAULTS: OK",
        "DECRYPTING HEARTBEAT FREQUENCIES...",
        "BYPASSING LOCK BLOCK CHAINS...",
        "SYNCHRONIZING MIDNIGHT TIMER ENVIRONMENT...",
        "DECRYPTION COMPLETED: REDIRECTING STREAM."
    ],
    logIndex: 0,

    init() {
        this.canvas = document.getElementById('matrix-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
    },

    resize() {
        if (!this.canvas) return;
        this.canvas.width = this.canvas.parentElement.clientWidth;
        this.canvas.height = this.canvas.parentElement.clientHeight;
        
        const numColumns = Math.floor(this.canvas.width / this.fontSize);
        this.columns = [];
        for (let i = 0; i < numColumns; i++) {
            this.columns[i] = Math.random() * -100;
        }
    },

    start() {
        if (!this.canvas) this.init();
        this.progress = 0;
        this.logIndex = 0;
        document.getElementById('matrix-progress').style.width = '0%';
        document.getElementById('matrix-terminal-logs').innerHTML = '';
        
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        
        this.loop();
        this.simulateLogs();
    },

    loop() {
        // Transparent black overlay to make trail fade
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Matrix columns loop
        this.ctx.fillStyle = '#ff2a85'; // Neon Pink rain
        this.ctx.font = `bold ${this.fontSize}px 'Fira Code', monospace`;
        
        for (let i = 0; i < this.columns.length; i++) {
            const char = this.chars[Math.floor(Math.random() * this.chars.length)];
            const x = i * this.fontSize;
            const y = this.columns[i] * this.fontSize;
            
            // Random glow effect on leading drop
            if (Math.random() > 0.98) {
                this.ctx.fillStyle = '#ffffff';
                this.ctx.shadowBlur = 10;
                this.ctx.shadowColor = '#ff2a85';
            } else {
                this.ctx.fillStyle = 'hsl(335, 100%, ' + (50 + Math.random() * 20) + '%)';
                this.ctx.shadowBlur = 0;
            }
            
            this.ctx.fillText(char, x, y);
            
            // Reset drop column back to top
            if (y > this.canvas.height && Math.random() > 0.975) {
                this.columns[i] = 0;
            }
            
            this.columns[i]++;
        }
        
        this.animationFrameId = requestAnimationFrame(() => this.loop());
    },

    simulateLogs() {
        const logBox = document.getElementById('matrix-terminal-logs');
        const progressBar = document.getElementById('matrix-progress');
        
        const logTimer = setInterval(() => {
            if (this.logIndex < this.logs.length) {
                const line = document.createElement('div');
                line.className = 'matrix-log-line';
                if (this.logIndex === this.logs.length - 1) line.className += ' success';
                
                const time = new Date().toLocaleTimeString();
                line.textContent = `[${time}] ${this.logs[this.logIndex]}`;
                logBox.appendChild(line);
                logBox.scrollTop = logBox.scrollHeight;
                
                this.logIndex++;
                
                // Advance progress fill
                this.progress = (this.logIndex / this.logs.length) * 100;
                progressBar.style.width = `${this.progress}%`;
            } else {
                clearInterval(logTimer);
                setTimeout(() => {
                    cancelAnimationFrame(this.animationFrameId);
                    appState.transitionTo('countdown');
                }, 1200);
            }
        }, 800);
    }
};

// ==========================================================================
// STEP 3: THE MIDNIGHT COUNTDOWN TIMER
// ==========================================================================
const countdownTimer = {
    intervalId: null,
    particlesContainer: null,
    
    init() {
        this.particlesContainer = document.getElementById('countdown-particles');
        this.createFloatingParticles();
    },

    createFloatingParticles() {
        if (!this.particlesContainer) return;
        this.particlesContainer.innerHTML = '';
        for (let i = 0; i < 40; i++) {
            const particle = document.createElement('div');
            particle.style.cssText = `
                position: absolute;
                width: ${2 + Math.random() * 4}px;
                height: ${2 + Math.random() * 4}px;
                background-color: hsla(${335 + Math.random()*30}, 100%, 70%, ${0.2 + Math.random()*0.5});
                top: ${Math.random() * 100}%;
                left: ${Math.random() * 100}%;
                border-radius: 50%;
                pointer-events: none;
                animation: floatAnim ${10 + Math.random() * 20}s infinite linear;
            `;
            this.particlesContainer.appendChild(particle);
        }
    },

    start() {
        if (this.intervalId) clearInterval(this.intervalId);
        this.createFloatingParticles();
        
        // Target: May 3rd, Midnight (00:00:00) of current year
        const currentYear = new Date().getFullYear();
        let targetDate = new Date(`May 3, ${currentYear} 00:00:00`).getTime();
        
        const tick = () => {
            const now = Date.now() + appState.virtualTimeOffset;
            const diff = targetDate - now;
            
            const statusText = document.getElementById('countdown-status-text');
            
            // Standard Tick updates
            if (diff > 10000) {
                statusText.textContent = "Clocks synchronized. System unlocked on May 3rd.";
                
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const secs = Math.floor((diff % (1000 * 60)) / 1000);
                
                document.getElementById('time-days').textContent = String(days).padStart(2, '0');
                document.getElementById('time-hours').textContent = String(hours).padStart(2, '0');
                document.getElementById('time-mins').textContent = String(mins).padStart(2, '0');
                document.getElementById('time-secs').textContent = String(secs).padStart(2, '0');
            }
            // Trigger 10-Second Dramatic Sequence
            else if (diff > 0 && diff <= 10000) {
                const secsRemaining = Math.ceil(diff / 1000);
                
                // Render standard timer values to 0
                document.getElementById('time-days').textContent = '00';
                document.getElementById('time-hours').textContent = '00';
                document.getElementById('time-mins').textContent = '00';
                document.getElementById('time-secs').textContent = String(secsRemaining).padStart(2, '0');
                
                // Show fullscreen countdown digits overlay
                const finalOverlay = document.getElementById('final-countdown-overlay');
                const bigNum = document.getElementById('countdown-big-num');
                
                if (!finalOverlay.classList.contains('active')) {
                    finalOverlay.classList.add('active');
                }
                
                if (bigNum.textContent !== String(secsRemaining)) {
                    bigNum.textContent = secsRemaining;
                    audioSynth.playHeartbeat();
                }
            } 
            // Midnight striked! (timer <= 0)
            else {
                clearInterval(this.intervalId);
                
                // Set displays to 0
                document.getElementById('time-days').textContent = '00';
                document.getElementById('time-hours').textContent = '00';
                document.getElementById('time-mins').textContent = '00';
                document.getElementById('time-secs').textContent = '00';
                
                // Final Blast celebration
                const finalOverlay = document.getElementById('final-countdown-overlay');
                const bigNum = document.getElementById('countdown-big-num');
                bigNum.textContent = "🎂";
                
                audioSynth.playCelebration();
                confetti({
                    particleCount: 150,
                    spread: 80,
                    origin: { y: 0.6 }
                });
                
                setTimeout(() => {
                    finalOverlay.classList.remove('active');
                    appState.transitionTo('cake');
                }, 1800);
            }
        };
        
        tick();
        this.intervalId = setInterval(tick, 1000);
    }
};

// ==========================================================================
// STEP 4: SVG CAKE INTERACTIVE SYSTEM
// ==========================================================================
const cakeExperience = {
    audioContext: null,
    analyser: null,
    dataArray: null,
    source: null,
    microphoneStream: null,
    isListeningToMic: false,

    reset() {
        appState.cakeStage = 0;
        
        // Hide SVGs
        document.getElementById('cream-dollops').style.opacity = '0';
        document.getElementById('candles-group').style.opacity = '0';
        
        // Reset candles positions and flames
        const candleYElements = document.querySelectorAll('#candles-group > g');
        candleYElements.forEach(g => {
            g.style.transform = `translate(${g.getAttribute('transform').split(',')[0].replace('translate(','')}, -200px)`;
        });
        
        for (let i = 1; i <= 5; i++) {
            document.getElementById(`flame-${i}`).style.opacity = '0';
            document.getElementById(`glow-${i}`).style.opacity = '0';
        }
        
        // Reset controls buttons
        document.getElementById('cake-instruction').textContent = "A fresh birthday cake has appeared!";
        document.getElementById('btn-place-candles').classList.remove('d-none');
        document.getElementById('btn-light-candles').classList.add('d-none');
        document.getElementById('blow-controls').classList.add('d-none');
        
        this.stopMicrophone();
    },

    placeCandles() {
        appState.cakeStage = 1;
        audioSynth.playChime();
        
        document.getElementById('cake-instruction').textContent = "Frosting and candles aligned. Now light the spark!";
        document.getElementById('btn-place-candles').classList.add('d-none');
        
        // Cream dollops fly in
        const dollops = document.getElementById('cream-dollops');
        dollops.style.opacity = '1';
        
        // Drop candles with delay
        const candlesGroup = document.getElementById('candles-group');
        candlesGroup.style.opacity = '1';
        
        const candleElements = document.querySelectorAll('#candles-group > g');
        candleElements.forEach((g, index) => {
            const baseTransform = g.getAttribute('transform');
            const match = baseTransform.match(/translate\(([^,\)]+),?\s*([^,\)]+)?\)/);
            const x = match[1];
            const originalY = match[2] || '0';
            
            // Drop down transition
            setTimeout(() => {
                g.style.transition = 'transform 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
                g.style.transform = `translate(${x}px, ${originalY}px)`;
                
                // Soft landing tick sound
                setTimeout(() => {
                    audioSynth.beat(audioSynth.ctx.currentTime, 150, 0.04);
                }, 800);
            }, index * 200);
        });

        // Show Next button
        setTimeout(() => {
            document.getElementById('btn-light-candles').classList.remove('d-none');
        }, 1500);
    },

    lightCandles() {
        if (appState.cakeStage !== 1) return;
        appState.cakeStage = 2;
        audioSynth.playChime();
        
        document.getElementById('cake-instruction').textContent = "The candles are glowing! Make your wish, then blow them out.";
        document.getElementById('btn-light-candles').classList.add('d-none');
        document.getElementById('blow-controls').classList.remove('d-none');
        
        // Slowly light each candle
        for (let i = 1; i <= 5; i++) {
            setTimeout(() => {
                const flame = document.getElementById(`flame-${i}`);
                const glow = document.getElementById(`glow-${i}`);
                
                flame.style.transition = 'opacity 0.4s ease';
                glow.style.transition = 'opacity 0.4s ease';
                flame.style.opacity = '1';
                glow.style.opacity = '1';
                
                // Crackle sound node
                audioSynth.beat(audioSynth.ctx.currentTime, 600, 0.02);
            }, i * 300);
        }
    },

    blowOutCandles() {
        if (appState.cakeStage !== 2) return;
        appState.cakeStage = 3;
        
        this.stopMicrophone();
        audioSynth.playSwoosh();
        
        // Extinguish flames
        for (let i = 1; i <= 5; i++) {
            document.getElementById(`flame-${i}`).style.opacity = '0';
            document.getElementById(`glow-${i}`).style.opacity = '0';
        }
        
        document.getElementById('cake-instruction').textContent = "Your wishes have been locked into the universe! 💖";
        document.getElementById('blow-controls').classList.add('d-none');
        
        // Explode confetti!
        setTimeout(() => {
            audioSynth.playCelebration();
            confetti({
                particleCount: 180,
                spread: 100,
                origin: { y: 0.55 }
            });
        }, 400);

        // Show Next Button to Wish Message
        setTimeout(() => {
            appState.transitionTo('wish');
        }, 2500);
    },

    async startMicrophone() {
        if (this.isListeningToMic) return;
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            this.microphoneStream = stream;
            
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            this.audioContext = audioCtx;
            
            this.source = audioCtx.createMediaStreamSource(stream);
            this.analyser = audioCtx.createAnalyser();
            this.analyser.fftSize = 256;
            
            const bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(bufferLength);
            
            this.source.connect(this.analyser);
            this.isListeningToMic = true;
            
            document.getElementById('btn-mic-enable').textContent = "Listening...";
            document.getElementById('btn-mic-enable').className = "btn btn-accent";
            
            showToast("Microphone calibrated! Try blowing on your screen.", "success");
            this.listenLoop();
        } catch(e) {
            console.error("Mic error:", e);
            showToast("Could not access microphone. Use click bypass.", "error");
        }
    },

    listenLoop() {
        if (!this.isListeningToMic) return;
        
        this.analyser.getByteFrequencyData(this.dataArray);
        
        // Analyze volume amplitude
        let sum = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
            sum += this.dataArray[i];
        }
        const average = sum / this.dataArray.length;
        const normalizedVol = Math.min(100, (average / 128) * 100);
        
        // Update volume meter fill
        document.getElementById('mic-meter-fill').style.width = `${normalizedVol}%`;
        
        // Volume Threshold representing blowing (e.g. sustained medium frequency noise)
        if (normalizedVol > 60) {
            // Register blowout
            setTimeout(() => {
                this.blowOutCandles();
            }, 300);
            return;
        }
        
        requestAnimationFrame(() => this.listenLoop());
    },

    stopMicrophone() {
        this.isListeningToMic = false;
        if (this.microphoneStream) {
            this.microphoneStream.getTracks().forEach(track => track.stop());
        }
        if (this.audioContext) {
            this.audioContext.close();
        }
        const micBtn = document.getElementById('btn-mic-enable');
        if (micBtn) {
            micBtn.textContent = "Use Microphone 🎤";
            micBtn.className = "btn btn-secondary";
        }
        const meterFill = document.getElementById('mic-meter-fill');
        if (meterFill) meterFill.style.width = '0%';
    }
};

// Key event listener for cake lighting prompt [E]
window.addEventListener('keydown', (e) => {
    if (appState.currentView === 'cake') {
        if ((e.key === 'e' || e.key === 'E') && appState.cakeStage === 1) {
            cakeExperience.lightCandles();
        }
    }
});

// ==========================================================================
// STEP 5: BIRTHDAY WISH MESSAGE VIEW
// ==========================================================================
const birthdayWish = {
    wishLines: [
        "To a very special human, 🌸",
        "Today marks the beginning of another beautiful trip around the sun.",
        "Through every laugh shared, every quiet moment, and every tiny step, you've shown a warmth that is rare in this world.",
        "May this year wrap you in peace, unlock your wildest ambitions, and remind you how deeply valued you are.",
        "Thank you for being you, completely.",
        "Here is to your special day, and all the days to come. 💕"
    ],
    lineIndex: 0,
    charIndex: 0,
    container: null,
    sessionId: 0,

    triggerTyping() {
        this.sessionId++;
        const mySession = this.sessionId;

        this.container = document.getElementById('wish-message-body');
        this.container.innerHTML = '';
        this.lineIndex = 0;
        this.charIndex = 0;

        document.getElementById('btn-go-memories').classList.add('d-none');

        this.typeNextLine(mySession);
        this.createHeartFloating();
    },

    typeNextLine(mySession) {
        if (mySession !== this.sessionId) return;
        if (this.lineIndex < this.wishLines.length) {
            const paragraph = document.createElement('p');
            paragraph.style.marginBottom = '1rem';
            if (this.lineIndex === 0) paragraph.className = 'wish-letter-highlight';
            this.container.appendChild(paragraph);

            const text = this.wishLines[this.lineIndex];
            this.charIndex = 0;

            const typeChar = () => {
                if (mySession !== this.sessionId) return;
                if (this.charIndex < text.length) {
                    paragraph.textContent += text[this.charIndex];
                    this.charIndex++;
                    setTimeout(typeChar, 25);
                } else {
                    this.lineIndex++;
                    setTimeout(() => this.typeNextLine(mySession), 600);
                }
            };
            typeChar();
        } else {
            const nextBtn = document.getElementById('btn-go-memories');
            nextBtn.classList.remove('d-none');
            nextBtn.classList.add('pulse-pink');
        }
    },

    createHeartFloating() {
        const particlesContainer = document.getElementById('wish-particles');
        particlesContainer.innerHTML = '';
        const shapes = ['fa-heart', 'fa-sparkles', 'fa-star'];

        for (let i = 0; i < 20; i++) {
            const shape = shapes[Math.floor(Math.random() * shapes.length)];
            const icon = document.createElement('i');
            icon.className = `fa-solid ${shape}`;
            icon.style.cssText = `
                position: absolute;
                font-size: ${10 + Math.random() * 20}px;
                color: hsla(${335 + Math.random()*40}, 100%, 75%, ${0.15 + Math.random()*0.3});
                bottom: -50px;
                left: ${Math.random() * 100}%;
                pointer-events: none;
                animation: floatUp ${6 + Math.random() * 10}s infinite linear;
                animation-delay: ${Math.random() * 8}s;
            `;
            particlesContainer.appendChild(icon);
        }
    }
};

// Add standard keyframe rules dynamically for floating hearts
const styleSheet = document.createElement("style");
styleSheet.innerText = `
@keyframes floatUp {
    0% { transform: translateY(0) rotate(0deg); opacity: 0; }
    10% { opacity: 0.6; }
    90% { opacity: 0.6; }
    100% { transform: translateY(-110vh) rotate(360deg); opacity: 0; }
}
`;
document.head.appendChild(styleSheet);

// ==========================================================================
// STEP 6 & 7: MEMORIES GALLERY & PASSWORD-LOCKED LETTER
// ==========================================================================
const memoriesGallery = {
    currentCardId: null,

    init() {
        document.querySelectorAll('.memory-card').forEach(card => {
            card.addEventListener('click', () => {
                this.openDetail(card.getAttribute('data-card-id'));
            });
        });

        document.getElementById('memory-detail-comment-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const input = document.getElementById('memory-detail-comment-input');
            const commentText = input.value.trim();
            if (commentText && this.currentCardId) {
                this.addComment(this.currentCardId, commentText);
                input.value = '';
            }
        });

        document.getElementById('btn-back-to-memories').addEventListener('click', () => {
            appState.transitionTo('memories');
        });

        document.getElementById('envelope-trigger').addEventListener('click', () => {
            audioSynth.init();
            document.getElementById('view-keypad').classList.add('active');
            keypadController.reset();
        });
    },

    openDetail(cardId) {
        this.currentCardId = cardId;
        const data = memoriesData[cardId];
        if (!data) return;

        document.getElementById('memory-detail-img').src = data.image;
        document.getElementById('memory-detail-img').alt = data.title;
        document.getElementById('memory-detail-tag').textContent = data.tag;
        document.getElementById('memory-detail-title').textContent = data.title;
        document.getElementById('memory-detail-desc').textContent = data.desc;

        this.renderDetailComments();
        appState.transitionTo('memory-detail');
    },

    renderDetailComments() {
        const historyBox = document.getElementById('memory-detail-comments');
        historyBox.innerHTML = '';
        (appState.comments[this.currentCardId] || []).forEach(comment => {
            const item = document.createElement('div');
            item.className = 'comment-item';
            item.textContent = comment;
            historyBox.appendChild(item);
        });
        historyBox.scrollTop = historyBox.scrollHeight;
    },

    addComment(cardId, text) {
        if (!appState.comments[cardId]) appState.comments[cardId] = [];
        appState.comments[cardId].push(text);
        localStorage.setItem('birthday_comments', JSON.stringify(appState.comments));

        this.renderDetailComments();
        showToast("Memory comment recorded! 💖", "success");

        if (appState.webhookUrl) {
            this.sendWebhookNotification(cardId, text);
        }
    },

    sendWebhookNotification(cardId, text) {
        const payload = {
            username: "Birthday Memory Vault",
            avatar_url: "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f382.png",
            content: `✨ **New Memory comment!** ✨\n> Memory Section: **Card ${cardId}**\n> Comment: _"${text}"_\n📅 Timestamp: ${new Date().toLocaleString()}`
        };
        fetch(appState.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(r => showToast(r.ok ? "Transmitted via webhook!" : "Webhook upload failed.", r.ok ? "success" : "error"))
        .catch(() => showToast("Webhook connection error.", "error"));
    }
};

// ==========================================================================
// BOUNCE CARDS ENGINE (ported from reactbits BounceCards logic)
// ==========================================================================
const bounceCards = {
    cards: [],
    baseTransforms: [],

    init() {
        this.cards = Array.from(document.querySelectorAll('.memory-card'));
        this.layout();

        this.cards.forEach((card, idx) => {
            const inner = card.querySelector('.memory-card-inner');
            inner.style.setProperty('--i', idx);

            card.addEventListener('mouseenter', () => this.pushSiblings(idx));
            card.addEventListener('mouseleave', () => this.resetSiblings());
        });

        window.addEventListener('resize', () => {
            this.layout();
            this.resetSiblings();
        });
    },

    layout() {
        const n = this.cards.length;
        const center = (n - 1) / 2;
        const isMobile = window.innerWidth <= 768;
        const step = isMobile ? 46 : 85;
        const rotStep = isMobile ? 3 : 4;

        this.baseTransforms = this.cards.map((_, i) => {
            const offset = i - center;
            const x = offset * step;
            const rot = offset * rotStep;
            return { x, rot };
        });

        this.cards.forEach((card, i) => {
            const { x, rot } = this.baseTransforms[i];
            card.style.zIndex = 10 - Math.abs(i - center);
            card.style.transform = `translateX(-50%) translate(${x}px) rotate(${rot}deg)`;
            card.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
        });
    },

    pushSiblings(hoveredIdx) {
        const isMobile = window.innerWidth <= 768;
        const pushAmount = isMobile ? 34 : 55;

        this.cards.forEach((card, i) => {
            const { x, rot } = this.baseTransforms[i];

            if (i === hoveredIdx) {
                card.style.transitionDelay = '0s';
                card.style.zIndex = 50;
                card.style.transform = `translateX(-50%) translate(${x}px) rotate(0deg) scale(1.15)`;
            } else {
                const direction = i < hoveredIdx ? -1 : 1;
                const distance = Math.abs(hoveredIdx - i);
                card.style.transitionDelay = `${distance * 0.05}s`;
                card.style.transform = `translateX(-50%) translate(${x + direction * pushAmount}px) rotate(${rot}deg)`;
            }
        });
    },

    resetSiblings() {
        this.cards.forEach((card, i) => {
            const { x, rot } = this.baseTransforms[i];
            const center = (this.cards.length - 1) / 2;
            card.style.transitionDelay = '0s';
            card.style.zIndex = 10 - Math.abs(i - center);
            card.style.transform = `translateX(-50%) translate(${x}px) rotate(${rot}deg)`;
        });
    }
};

// Keypad controller for password-locked envelope
const keypadController = {
    reset() {
        appState.enteredCode = '';
        this.updateDots();
        const feedback = document.getElementById('keypad-feedback');
        feedback.textContent = '';
        feedback.className = 'keypad-feedback';
        document.querySelector('.keypad-modal').classList.remove('shake');
    },

    addDigit(digit) {
        if (appState.enteredCode.length < 4) {
            appState.enteredCode += digit;
            this.updateDots();
            audioSynth.beat(audioSynth.ctx.currentTime, 300, 0.05);
            
            if (appState.enteredCode.length === 4) {
                setTimeout(() => this.verify(), 250);
            }
        }
    },

    removeDigit() {
        if (appState.enteredCode.length > 0) {
            appState.enteredCode = appState.enteredCode.slice(0, -1);
            this.updateDots();
            audioSynth.beat(audioSynth.ctx.currentTime, 200, 0.05);
        }
    },

    updateDots() {
        const dots = document.querySelectorAll('.passcode-dot');
        dots.forEach((dot, index) => {
            if (index < appState.enteredCode.length) {
                dot.classList.add('filled');
            } else {
                dot.classList.remove('filled');
            }
        });
    },

    verify() {
        const modal = document.querySelector('.keypad-modal');
        const feedback = document.getElementById('keypad-feedback');
        
        if (appState.enteredCode === appState.passcode) {
            // Correct!
            feedback.textContent = "VERIFICATION ACCEPTED";
            feedback.className = "keypad-feedback success";
            audioSynth.playChime();
            
            setTimeout(() => {
                document.getElementById('view-keypad').classList.remove('active');
                
                // Trigger sealed Envelope melting and open animation
                const env = document.getElementById('envelope-trigger');
                env.classList.add('unlocked');
                
                setTimeout(() => {
                    appState.transitionTo('letter');
                }, 1500);
            }, 800);
        } else {
            // Incorrect
            feedback.textContent = "INCORRECT PASSCODE";
            feedback.className = "keypad-feedback error";
            modal.classList.add('shake');
            
            // Soft fail sound
            audioSynth.beat(audioSynth.ctx.currentTime, 100, 0.3);
            
            setTimeout(() => {
                this.reset();
            }, 1000);
        }
    }
};

// Bind Keypad Buttons
document.querySelectorAll('.keypad-btn[data-val]').forEach(btn => {
    btn.addEventListener('click', () => {
        keypadController.addDigit(btn.getAttribute('data-val'));
    });
});

document.getElementById('keypad-clear').addEventListener('click', () => {
    keypadController.removeDigit();
});

document.getElementById('keypad-close').addEventListener('click', () => {
    document.getElementById('view-keypad').classList.remove('active');
});

// Bind Back buttons from Letter
document.getElementById('btn-close-letter').addEventListener('click', () => {
    appState.transitionTo('memories');
    // Relock envelope
    document.getElementById('envelope-trigger').classList.remove('unlocked');
});

// ==========================================================================
// TOAST SYSTEM & FLOATING DEMO PANEL
// ==========================================================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = '<i class="fa-solid fa-circle-info"></i>';
    if (type === 'success') icon = '<i class="fa-solid fa-circle-check"></i>';
    if (type === 'error') icon = '<i class="fa-solid fa-triangle-exclamation"></i>';
    
    toast.innerHTML = `${icon}<span>${message}</span>`;
    container.appendChild(toast);
    
    // Automatically delete after animation
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Dev panel actions toggles
const devPanel = {
    init() {
        const trigger = document.getElementById('btn-toggle-demo');
        const panel = document.getElementById('demo-panel');
        const closeBtn = document.getElementById('demo-close-btn');
        
        trigger.addEventListener('click', () => {
            panel.classList.toggle('active');
        });
        
        closeBtn.addEventListener('click', () => {
            panel.classList.remove('active');
        });

        // Load fields values
        document.getElementById('demo-webhook-url').value = appState.webhookUrl;
        document.getElementById('demo-passcode-val').value = appState.passcode;

        // Save actions binds
        document.getElementById('demo-save-webhook').addEventListener('click', () => {
            const url = document.getElementById('demo-webhook-url').value.trim();
            appState.webhookUrl = url;
            localStorage.setItem('birthday_webhook', url);
            showToast("Webhook URL stored locally!", "success");
        });

        document.getElementById('demo-save-passcode').addEventListener('click', () => {
            const code = document.getElementById('demo-passcode-val').value.trim();
            if (code.length === 4 && !isNaN(code)) {
                appState.passcode = code;
                localStorage.setItem('birthday_passcode', code);
                showToast(`Secret code updated to ${code}!`, "success");
            } else {
                showToast("Passcode must be exactly 4 digits.", "error");
            }
        });

        // Clock options
        document.getElementById('demo-trigger-normal').addEventListener('click', () => {
            appState.virtualTimeOffset = 0;
            showToast("System time reset to actual server clock.");
            countdownTimer.start();
        });

        document.getElementById('demo-trigger-immediate').addEventListener('click', () => {
            // Calculate time difference so target May 3rd is exactly 10 seconds ahead
            const currentYear = new Date().getFullYear();
            const targetDate = new Date(`May 3, ${currentYear} 00:00:00`).getTime();
            const tenSecondsBefore = targetDate - 10000;
            
            appState.virtualTimeOffset = tenSecondsBefore - Date.now();
            showToast("Simulating 10s before Midnight!", "success");
            
            // Jump to countdown screen to view it immediately
            appState.transitionTo('countdown');
        });
    }
};

// ==========================================================================
// CAKE SVG BUTTONS ATTACHMENTS
// ==========================================================================
document.getElementById('btn-place-candles').addEventListener('click', () => {
    cakeExperience.placeCandles();
});
document.getElementById('btn-light-candles').addEventListener('click', () => {
    cakeExperience.lightCandles();
});
document.getElementById('btn-mic-enable').addEventListener('click', () => {
    cakeExperience.startMicrophone();
});
document.getElementById('btn-blow-simulate').addEventListener('click', () => {
    cakeExperience.blowOutCandles();
});
document.getElementById('btn-go-memories').addEventListener('click', () => {
    appState.transitionTo('memories');
});

// Initialize on window loading completion
window.addEventListener('load', () => {
    qrCodeController.init();
    memoriesGallery.init();
    bounceCards.init();
    devPanel.init();
    
    showToast("System ready. Decrypt core payload.");
});