// 初始化 Firebase
// 初始化 Firebase（使用兼容模式）
firebase.initializeApp({
    apiKey: "AIzaSyAOqWdVLYWjnvo3vBCM9EXeK63v_KaseCA",
    authDomain: "stepcounterapp-cad8b.firebaseapp.com",
    databaseURL: "https://stepcounterapp-cad8b-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "stepcounterapp-cad8b",
    storageBucket: "stepcounterapp-cad8b.firebasestorage.app",
    messagingSenderId: "1052987290890",
    appId: "1:1052987290890:android:0f842d2b760623a9c8b6f3"
});

// 初始化 Analytics
firebase.analytics();

// 獲取數據庫引用
const db = firebase.database();

// 藍牙連接狀態管理
let bluetoothStatus = {
    isConnected: false,
    deviceName: '',
    lastError: null
};

// WebSocket 連接設置
const ws = new WebSocket('ws://localhost:8080');
let wsReconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// Chart.js 配置
let stepsChart;
const chartConfig = {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: '步數',
            data: [],
            borderColor: '#FFB74D',
            backgroundColor: 'rgba(255, 183, 77, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: {
                    color: 'rgba(255, 183, 77, 0.1)'
                }
            },
            x: {
                grid: {
                    display: false
                }
            }
        }
    }
};

// 初始化圖表
function initChart() {
    const ctx = document.getElementById('stepsChart').getContext('2d');
    stepsChart = new Chart(ctx, chartConfig);
}

// 更新統計數據
function updateStats(steps) {
    // 更新今日步數
    document.getElementById('todaySteps').textContent = steps;

    // 計算目標達成率（假設目標是 10000 步）
    const goalProgress = Math.min(Math.round((steps / 10000) * 100), 100);
    document.getElementById('goalProgress').textContent = `${goalProgress}%`;

    // 估算消耗熱量（粗略計算：每步消耗 0.04 千卡）
    const calories = Math.round(steps * 0.04);
    document.getElementById('calories').textContent = `${calories} kcal`;

    // 估算活動時間（假設平均每分鐘 100 步）
    const activeMinutes = Math.round(steps / 100);
    document.getElementById('activeTime').textContent = `${activeMinutes} 分鐘`;
}

// 更新圖表數據
function updateChart(steps, timestamp) {
    const date = new Date(timestamp);
    const timeStr = date.toLocaleTimeString('zh-TW', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });

    stepsChart.data.labels.push(timeStr);
    stepsChart.data.datasets[0].data.push(steps);

    // 只保留最近的30個數據點
    if (stepsChart.data.labels.length > 30) {
        stepsChart.data.labels.shift();
        stepsChart.data.datasets[0].data.shift();
    }

    stepsChart.update();
}

// AI 分析
async function analyzeActivity(steps) {
    // 載入簡單的 TensorFlow.js 模型
    const model = await createSimpleModel();
    
    // 根據步數進行活動強度分析
    let intensity;
    if (steps < 3000) {
        intensity = '低強度';
    } else if (steps < 7000) {
        intensity = '中強度';
    } else {
        intensity = '高強度';
    }

    // 更新 AI 分析區域
    document.getElementById('activityAnalysis').innerHTML = `
        <div class="suggestion">
            <div class="suggestion-icon">📊</div>
            <div>
                <p>今日活動強度：${intensity}</p>
                <p>步數：${steps} 步</p>
            </div>
        </div>
    `;

    // 更新建議
    updateSuggestions(steps, intensity);
}

// 更新建議
function updateSuggestions(steps, intensity) {
    let suggestion;
    if (steps < 3000) {
        suggestion = '建議：增加日常活動量，例如步行上下班或使用樓梯代替電梯。';
    } else if (steps < 7000) {
        suggestion = '做得很好！建議：保持運動習慣，可以嘗試增加運動強度。';
    } else {
        suggestion = '太棒了！您的活動量達到理想水平，記得適當休息和補充水分。';
    }

    document.getElementById('aiSuggestions').innerHTML = `
        <div class="suggestion">
            <div class="suggestion-icon">💡</div>
            <div>${suggestion}</div>
        </div>
    `;

    // 更新健康趨勢
    updateHealthTrend(steps);
}

// 更新健康趨勢
function updateHealthTrend(steps) {
    const trend = steps > 5000 ? '上升' : '下降';
    document.getElementById('healthTrend').innerHTML = `
        <div class="suggestion">
            <div class="suggestion-icon">📈</div>
            <div>
                <p>活動趨勢：${trend}</p>
                <p>持續保持良好的運動習慣，將幫助您維持健康的生活方式。</p>
            </div>
        </div>
    `;
}

// 創建簡單的 TensorFlow.js 模型
async function createSimpleModel() {
    const model = tf.sequential({
        layers: [
            tf.layers.dense({ units: 1, inputShape: [1] })
        ]
    });
    return model;
}

// 更新藍牙狀態顯示
function updateBluetoothStatus() {
    const statusElement = document.createElement('div');
    statusElement.className = 'bluetooth-status';
    statusElement.style.position = 'fixed';
    statusElement.style.top = '80px';
    statusElement.style.right = '20px';
    statusElement.style.padding = '10px';
    statusElement.style.borderRadius = '5px';
    statusElement.style.backgroundColor = bluetoothStatus.isConnected ? '#4CAF50' : '#f44336';
    statusElement.style.color = 'white';
    
    statusElement.textContent = bluetoothStatus.isConnected 
        ? `已連接: ${bluetoothStatus.deviceName || '未知設備'}`
        : '藍牙未連接';
        
    // 移除舊的狀態顯示
    const oldStatus = document.querySelector('.bluetooth-status');
    if (oldStatus) {
        oldStatus.remove();
    }
    
    document.body.appendChild(statusElement);
}

// 顯示錯誤訊息
function showError(message) {
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.style.position = 'fixed';
    errorElement.style.top = '20px';
    errorElement.style.left = '50%';
    errorElement.style.transform = 'translateX(-50%)';
    errorElement.style.backgroundColor = '#f44336';
    errorElement.style.color = 'white';
    errorElement.style.padding = '10px 20px';
    errorElement.style.borderRadius = '5px';
    errorElement.style.zIndex = '1000';
    
    errorElement.textContent = message;
    
    document.body.appendChild(errorElement);
    
    // 3秒後自動移除錯誤訊息
    setTimeout(() => {
        errorElement.remove();
    }, 3000);
}

// WebSocket 重連機制
function setupWebSocketReconnection() {
    ws.onclose = () => {
        console.log('WebSocket 連接關閉');
        if (wsReconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            wsReconnectAttempts++;
            console.log(`嘗試重新連接... (${wsReconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
            setTimeout(() => {
                location.reload();
            }, 5000);
        } else {
            showError('無法連接到服務器，請刷新頁面重試');
        }
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket 錯誤:', error);
        showError('連接出現錯誤，請檢查網路狀態');
    };
}

// WebSocket 事件處理
ws.onopen = () => {
    console.log('WebSocket 連接成功');
};

ws.onmessage = async (event) => {
    const data = JSON.parse(event.data);
    
    switch(data.type) {
        case 'step_data':
            // 更新 Firebase 數據
            const stepsRef = db.ref('steps');
            const newStepData = {
                steps: data.steps,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                height: data.height || 0,
                valid: data.valid || true,
                deviceId: data.deviceId || 'web-client',
                bluetoothDevice: bluetoothStatus.deviceName || 'unknown'
            };
            
            try {
                await stepsRef.push(newStepData);
                console.log('步數數據已同步到 Firebase');
                
                // 更新圖表和統計數據
                updateChart(data);
                updateStats(data);
                updateAIAnalysis(data);
            } catch (error) {
                console.error('Firebase 同步失敗:', error);
                showError('數據同步失敗，請檢查網路連接');
            }
            break;
            
        case 'bluetooth_status':
            bluetoothStatus = {
                ...bluetoothStatus,
                ...data.status
            };
            updateBluetoothStatus();
            break;
            
        case 'error':
            console.error('接收到錯誤:', data.message);
            showError(data.message);
            break;
    }
};

// 監聽 Firebase 數據變化
const stepsRef = db.ref('steps');
stepsRef.on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
        const stepsArray = Object.values(data)
            .sort((a, b) => a.timestamp - b.timestamp); // 按時間排序
        
        // 更新圖表和統計資料
        updateHistoricalData(stepsArray);
        
        // 更新今日總步數
        const today = new Date().toDateString();
        const todaySteps = stepsArray
            .filter(step => new Date(step.timestamp).toDateString() === today)
            .reduce((sum, step) => sum + step.steps, 0);
        
        document.getElementById('todaySteps').textContent = todaySteps;
    }
});

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initChart();
    setupWebSocketReconnection();
    updateBluetoothStatus(); // 初始化藍牙狀態顯示
});
