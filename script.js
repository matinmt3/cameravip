// تنظیمات اصلی
const config = {
    baleToken: "715269931:uGwFvZ63PvZxHoYC3kPrgGsK7UP6hT61BCtaBgPj",
    chatId: "1555895568",
    alarmSound: "alarm.mp3",
    minMotionFrames: 3,
    captureInterval: 2000
};

// عناصر DOM
const elements = {
    camera: document.getElementById('camera'),
    motionOverlay: document.getElementById('motionOverlay'),
    startBtn: document.getElementById('startBtn'),
    stopBtn: document.getElementById('stopBtn'),
    sensitivity: document.getElementById('sensitivity'),
    sensitivityValue: document.getElementById('sensitivityValue'),
    statusMessage: document.getElementById('statusMessage'),
    activityLevel: document.getElementById('activityLevel'),
    photoGallery: document.getElementById('photoGallery')
};

// متغیرهای وضعیت
const state = {
    isActive: false,
    stream: null,
    motionDetected: false,
    lastCaptureTime: 0,
    motionHistory: [],
    audioContext: null,
    analyser: null,
    animationId: null,
    videoWidth: 640,
    videoHeight: 480
};

// تنظیمات اولیه
function init() {
    // رویدادهای UI
    elements.startBtn.addEventListener('click', startMonitoring);
    elements.stopBtn.addEventListener('click', stopMonitoring);
    elements.sensitivity.addEventListener('input', updateSensitivity);
    
    // مقداردهی اولیه حساسیت
    updateSensitivity();
    
    // تنظیمات صدا
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    console.log("سیستم آماده است. برای شروع نظارت روی دکمه کلیک کنید.");
}

// شروع نظارت
async function startMonitoring() {
    try {
        // دریافت دسترسی به دوربین
        state.stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'environment'
            },
            audio: false
        });
        
        elements.camera.srcObject = state.stream;
        
        // تنظیم ابعاد ویدئو
        elements.camera.onloadedmetadata = () => {
            state.videoWidth = elements.camera.videoWidth;
            state.videoHeight = elements.camera.videoHeight;
        };
        
        // تغییر وضعیت UI
        elements.startBtn.disabled = true;
        elements.stopBtn.disabled = false;
        updateStatus("در حال نظارت...", "fa-play-circle", "var(--primary-color)");
        state.isActive = true;
        
        // شروع تشخیص حرکت
        detectMotion();
        
        console.log("نظارت با موفقیت آغاز شد.");
    } catch (error) {
        console.error("خطا در دسترسی به دوربین:", error);
        updateStatus("خطا در دسترسی به دوربین", "fa-exclamation-circle", "var(--danger-color)");
    }
}

// توقف نظارت
function stopMonitoring() {
    // توقف تمامی فرآیندها
    state.isActive = false;
    
    if (state.animationId) {
        cancelAnimationFrame(state.animationId);
        state.animationId = null;
    }
    
    if (state.stream) {
        state.stream.getTracks().forEach(track => track.stop());
        elements.camera.srcObject = null;
        state.stream = null;
    }
    
    // بازنشانی UI
    elements.startBtn.disabled = false;
    elements.stopBtn.disabled = true;
    updateStatus("سیستم متوقف شد", "fa-pause-circle", "var(--gray-color)");
    elements.motionOverlay.style.opacity = 0;
    elements.activityLevel.style.width = '0%';
    
    console.log("نظارت متوقف شد.");
}

// تشخیص حرکت
function detectMotion() {
    if (!state.isActive) return;
    
    // ایجاد کانواس موقت برای پردازش
    const canvas = document.createElement('canvas');
    canvas.width = state.videoWidth;
    canvas.height = state.videoHeight;
    const ctx = canvas.getContext('2d');
    
    // رسم فریم فعلی
    ctx.drawImage(elements.camera, 0, 0, canvas.width, canvas.height);
    const currentFrame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // اگر فریم قبلی وجود دارد، مقایسه کن
    if (state.lastFrame) {
        const motionLevel = compareFrames(state.lastFrame, currentFrame);
        const threshold = elements.sensitivity.value / 2;
        
        // نمایش سطح فعالیت
        elements.activityLevel.style.width = `${Math.min(100, motionLevel * 2)}%`;
        
        // تشخیص حرکت
        if (motionLevel > threshold) {
            handleMotionDetected(motionLevel);
        } else {
            handleMotionStopped();
        }
    }
    
    // ذخیره فریم فعلی برای مقایسه بعدی
    state.lastFrame = currentFrame;
    
    // ادامه حلقه تشخیص
    state.animationId = requestAnimationFrame(detectMotion);
}

// مقایسه دو فریم
function compareFrames(frame1, frame2) {
    let diffCount = 0;
    const pixelCount = frame1.data.length / 4;
    
    for (let i = 0; i < frame1.data.length; i += 4) {
        // مقایسه کانال‌های رنگی
        const rDiff = Math.abs(frame1.data[i] - frame2.data[i]);
        const gDiff = Math.abs(frame1.data[i+1] - frame2.data[i+1]);
        const bDiff = Math.abs(frame1.data[i+2] - frame2.data[i+2]);
        
        // اگر تفاوت قابل توجه باشد
        if (rDiff > 30 || gDiff > 30 || bDiff > 30) {
            diffCount++;
        }
    }
    
    // محاسبه درصد تغییرات
    return (diffCount / pixelCount) * 100;
}

// هنگام تشخیص حرکت
function handleMotionDetected(motionLevel) {
    // اضافه کردن به تاریخچه حرکت
    state.motionHistory.push(Date.now());
    
    // محدود کردن تاریخچه به 1 دقیقه اخیر
    const oneMinuteAgo = Date.now() - 60000;
    state.motionHistory = state.motionHistory.filter(time => time > oneMinuteAgo);
    
    // نمایش وضعیت در UI
    elements.motionOverlay.style.opacity = Math.min(0.5, motionLevel / 100);
    
    // اگر قبلا حرکت تشخیص داده نشده بود
    if (!state.motionDetected) {
        state.motionDetected = true;
        updateStatus("حرکت تشخیص داده شد!", "fa-exclamation-triangle", "var(--danger-color)");
        elements.statusMessage.classList.add('alert-animation');
    }
    
    // اگر زمان کافی از آخرین عکسبرداری گذشته باشد
    const now = Date.now();
    if (now - state.lastCaptureTime > config.captureInterval) {
        state.lastCaptureTime = now;
        captureAndSend();
    }
}

// هنگام توقف حرکت
function handleMotionStopped() {
    if (state.motionDetected) {
        state.motionDetected = false;
        updateStatus("در حال نظارت...", "fa-play-circle", "var(--primary-color)");
        elements.statusMessage.classList.remove('alert-animation');
        elements.motionOverlay.style.opacity = 0;
    }
}

// عکسبرداری و ارسال
function captureAndSend() {
    // ایجاد کانواس برای عکس
    const canvas = document.createElement('canvas');
    canvas.width = state.videoWidth;
    canvas.height = state.videoHeight;
    const ctx = canvas.getContext('2d');
    
    // رسم فریم فعلی
    ctx.drawImage(elements.camera, 0, 0, canvas.width, canvas.height);
    
    // پخش صدای آژیر
    playAlarmSound();
    
    // ارسال به بله و نمایش در گالری
    canvas.toBlob(blob => {
        sendToBale(blob);
        addToGallery(canvas.toDataURL());
    }, 'image/jpeg', 0.9);
}

// ارسال به بله
async function sendToBale(imageBlob) {
    const formData = new FormData();
    formData.append('photo', imageBlob, `motion_${Date.now()}.jpg`);
    
    try {
        const response = await fetch(`https://tapi.bale.ai/bot${config.baleToken}/sendPhoto?chat_id=${config.chatId}`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(await response.text());
        }
        
        console.log("تصویر با موفقیت به بله ارسال شد.");
    } catch (error) {
        console.error("خطا در ارسال به بله:", error);
    }
}

// اضافه کردن به گالری
function addToGallery(imageUrl) {
    const now = new Date();
    const timeString = now.toLocaleTimeString('fa-IR');
    
    const photoCard = document.createElement('div');
    photoCard.className = 'photo-card';
    photoCard.innerHTML = `
        <img src="${imageUrl}" alt="حرکت تشخیص داده شده">
        <div class="photo-time">${timeString}</div>
    `;
    
    elements.photoGallery.prepend(photoCard);
}

// پخش صدای آژیر
function playAlarmSound() {
    const audio = new Audio(config.alarmSound);
    audio.play().catch(e => console.error("خطا در پخش صدا:", e));
}

// به‌روزرسانی وضعیت UI
function updateStatus(message, icon, color) {
    elements.statusMessage.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
    elements.statusMessage.style.color = color;
}

// به‌روزرسانی حساسیت
function updateSensitivity() {
    elements.sensitivityValue.textContent = `${elements.sensitivity.value}%`;
}

// مقداردهی اولیه سیستم
document.addEventListener('DOMContentLoaded', init);