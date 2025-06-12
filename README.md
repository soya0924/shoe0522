# AI 智慧步數分析系統

## 設計動機
在現代快節奏的生活中，許多人因工作忙碌而缺乏運動，尤其是年輕上班族。世界衛生組織建議每人每天至少走8000步，但根據調查，超過60%的上班族每天步數不足5000步。本系統旨在透過智能化的步數追蹤和個人化的運動建議，幫助使用者建立健康的運動習慣。

### 核心理念
1. **即時追蹤**：隨時掌握活動量
2. **智能分析**：根據個人情況提供建議
3. **激勵機制**：透過成就系統鼓勵持續運動
4. **便利性**：無需額外操作，自動記錄

## 使用場景
### 1. 辦公室上班族
- **情境**：久坐辦公室的上班族
- **需求**：提醒適時走動、注意活動量
- **解決方案**：
  - 每小時久坐提醒
  - 建議適合的休息時間散步路線
  - 追蹤工作日步數變化

### 2. 居家工作者
- **情境**：遠端工作的專業人士
- **需求**：增加日常活動量
- **解決方案**：
  - 提供室內運動建議
  - 追蹤家中走動頻率
  - 建議適合的運動時段

### 3. 學生族群
- **情境**：學習壓力大的學生
- **需求**：平衡學習和運動
- **解決方案**：
  - 課間活動建議
  - 結合讀書時間的運動規劃
  - 提供壓力釋放的運動方案

### 4. 銀髮族
- **情境**：退休長者
- **需求**：保持適度運動量
- **解決方案**：
  - 根據身體狀況調整建議步數
  - 提供安全的運動建議
  - 記錄每日活動規律性

## 使用者設定

### 1. 個人資料設定
- **基本信息**
  - 年齡範圍
  - 職業類型
  - 身體狀況
  - 運動習慣

- **目標設定**
  - 每日基本步數（預設8000步）
  - 週目標達成天數
  - 特定時段活動提醒

### 2. 智能調整參數
- **活動強度**
  - 輕度活動：每分鐘90-100步
  - 中度活動：每分鐘100-120步
  - 高強度活動：每分鐘120步以上

- **時間區間**
  - 工作時段（9:00-18:00）
  - 休息時段（12:00-13:00）
  - 運動時段（自定義）

### 3. 通知設定
- **提醒頻率**
  - 久坐提醒（30/60分鐘可選）
  - 目標達成提醒
  - 日報表推送時間

- **激勵機制**
  - 成就解鎖通知
  - 目標完成慶祝
  - 連續達標獎勵

### 4. 數據展示偏好
- **圖表類型**
  - 每日步數長條圖
  - 週/月趨勢線圖
  - 活動熱力圖

- **分析報告**
  - 日報表
  - 週總結
  - 月度分析

## 基本材料清單
### 硬體需求
- Arduino Nano
- MPU6050 加速度計
- 鋰電池（3.7V）
- HC-05 藍牙模組
- 簡易塑料外殼
- 魔鬼氈手環帶

### 開發環境
- Arduino IDE
- Visual Studio Code
- Node.js
- MongoDB

## 基本功能
1. **硬體功能**
   - 步數測量
   - 藍牙傳輸數據
   - 電池供電

2. **網頁功能**
   - 顯示即時步數
   - 顯示AI運動建議
   - 設定每日目標

3. **AI 功能**
   - 分析每日活動量
   - 生成運動建議

## 實作步驟

### 1. 硬體組裝（2-3天）
1. 連接元件
   - MPU6050 接到 Arduino Nano (使用 I2C)
   - 藍牙模組接到 Arduino (使用 Serial)
   - 接上電池供電

2. 基礎程式
```cpp
// Arduino 程式架構
#include <Wire.h>
#include <MPU6050.h>
#include <SoftwareSerial.h>

MPU6050 mpu;
SoftwareSerial BTSerial(10, 11); // RX, TX pins

// 計步器變數
long lastStepTime = 0;
int stepCount = 0;
float threshold = 1.5; // 加速度閾值，可根據實際情況調整
float lastAcc = 0;
bool isPeak = false;

void setup() {
    // 初始化序列通訊
    Serial.begin(9600);
    BTSerial.begin(9600);
    
    // 初始化 MPU6050
    Wire.begin();
    mpu.initialize();
    
    // 確認連接是否成功
    if (!mpu.testConnection()) {
        Serial.println("MPU6050 連接失敗");
        while (1);
    }
    
    // 設定 MPU6050 範圍
    mpu.setFullScaleAccelRange(MPU6050_ACCEL_FS_2);
}

void loop() {
    // 讀取加速度數據
    int16_t ax, ay, az;
    mpu.getAcceleration(&ax, &ay, &az);
    
    // 計算合成加速度
    float accMagnitude = sqrt(pow(ax/16384.0, 2) + 
                            pow(ay/16384.0, 2) + 
                            pow(az/16384.0, 2));
    
    // 步數檢測演算法
    if (detectStep(accMagnitude)) {
        stepCount++;
        sendStepData();
    }
    
    delay(10); // 短暫延遲避免數據過多
}

// 步數檢測函數
boolean detectStep(float acc) {
    boolean isStep = false;
    
    // 檢測波峰
    if (acc > lastAcc && acc > threshold && !isPeak) {
        isPeak = true;
    }
    
    // 檢測波谷
    if (acc < lastAcc && isPeak) {
        long currentTime = millis();
        
        // 確保兩步之間有足夠的時間間隔（防止誤判）
        if (currentTime - lastStepTime > 300) { // 300ms 最小間隔
            isStep = true;
            lastStepTime = currentTime;
        }
        isPeak = false;
    }
    
    lastAcc = acc;
    return isStep;
}

// 發送步數數據
void sendStepData() {
    // 封裝數據為 JSON 格式
    String data = "{\"steps\":" + String(stepCount) + "}";
    
    // 透過藍牙發送
    BTSerial.println(data);
    
    // 同時在序列監視器顯示（用於調試）
    Serial.println(data);
}
```

### 2. 後端建置（2-3天）
1. 基本架構
```javascript
// Express 伺服器
const express = require('express');
const app = express();

// 藍牙數據接收
app.post('/api/steps', (req, res) => {
  // 儲存步數數據
});

// AI 分析端點
app.get('/api/analysis', (req, res) => {
  // 分析數據並返回建議
});
```

2. 資料庫
```javascript
// MongoDB 結構
const userSchema = {
  dailySteps: Number,
  goals: Number,
  history: Array
}
```

### 3. 前端開發（2-3天）
1. 基本頁面
```html
<!-- 主頁面結構 -->
<div>
  <h2>今日步數：<span id="steps">0</span></h2>
  <h3>目標：<input type="number" id="goal"/></h3>
  <div id="recommendation"></div>
</div>
```

2. 數據顯示
```javascript
// 更新步數
function updateSteps(steps) {
  document.getElementById('steps').innerText = steps;
}

// 獲取AI建議
async function getRecommendation() {
  // 從後端獲取分析結果
}
```

### 4. AI 模型（1-2天）
- 使用簡單的規則基礎系統
- 根據步數和目標提供建議
```javascript
function analyzeActivity(steps, goal) {
  if (steps < goal * 0.3) {
    return "建議增加活動量";
  } else if (steps < goal) {
    return "達成目標還差一點！";
  } else {
    return "太棒了！已達成目標";
  }
}
```

## 網頁實作細節

### 1. 前端架構
```html
<!-- index.html -->
<!DOCTYPE html>
<html>
<head>
    <title>智慧步數分析系統</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/tensorflow.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary-yellow: #FFD700;
            --light-yellow: #FFF8DC;
            --warm-yellow: #FFE4B5;
            --accent-yellow: #FFB74D;
            --text-dark: #4A4A4A;
            --text-light: #6E6E6E;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Noto Sans TC', sans-serif;
        }

        body {
            background-color: var(--light-yellow);
            color: var(--text-dark);
        }

        .header {
            background: linear-gradient(135deg, #FFF, var(--warm-yellow));
            padding: 1rem 2rem;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            display: flex;
            justify-content: space-between;
            align-items: center;
            position: fixed;
            width: 100%;
            top: 0;
            z-index: 100;
        }

        .profile {
            display: flex;
            align-items: center;
            gap: 1rem;
        }

        .avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: #e9ecef;
            overflow: hidden;
        }

        .avatar img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 2rem;
            padding: 6rem 2rem 2rem;
            max-width: 1400px;
            margin: 0 auto;
        }

        .data-panel {
            background: white;
            border-radius: 12px;
            padding: 2rem;
            box-shadow: 0 4px 6px rgba(255, 183, 77, 0.1);
            border: 1px solid var(--warm-yellow);
        }

        .chart-container {
            height: 300px;
            margin: 1.5rem 0;
            background: rgba(255, 248, 220, 0.3);
            padding: 1rem;
            border-radius: 8px;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 1.5rem;
            margin-top: 2rem;
        }

        .stat-card {
            background: linear-gradient(145deg, white, var(--light-yellow));
            padding: 1.5rem;
            border-radius: 8px;
            text-align: center;
            border: 1px solid var(--warm-yellow);
            transition: transform 0.3s ease;
        }

        .stat-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 4px 12px rgba(255, 183, 77, 0.2);
        }

        .stat-card h3 {
            color: var(--text-light);
            font-size: 0.9rem;
            margin-bottom: 0.5rem;
        }

        .stat-card .value {
            font-size: 1.5rem;
            font-weight: 500;
            color: var(--text-dark);
            text-shadow: 1px 1px 1px rgba(255, 183, 77, 0.1);
        }

        .ai-analysis {
            background: white;
            border-radius: 12px;
            padding: 2rem;
            box-shadow: 0 4px 6px rgba(255, 183, 77, 0.1);
            border: 1px solid var(--warm-yellow);
        }

        .analysis-card {
            background: linear-gradient(145deg, white, var(--light-yellow));
            padding: 1.5rem;
            border-radius: 8px;
            margin-top: 1.5rem;
            border: 1px solid var(--warm-yellow);
            transition: all 0.3s ease;
        }

        .analysis-card:hover {
            box-shadow: 0 4px 12px rgba(255, 183, 77, 0.2);
        }

        .analysis-card h3 {
            color: var(--text-dark);
            margin-bottom: 1rem;
            font-size: 1.1rem;
            border-bottom: 2px solid var(--accent-yellow);
            padding-bottom: 0.5rem;
            display: inline-block;
        }

        .suggestion {
            display: flex;
            align-items: center;
            gap: 1rem;
            padding: 1rem;
            background: white;
            border-radius: 8px;
            margin-top: 1rem;
        }

        .suggestion-icon {
            width: 40px;
            height: 40px;
            background: #e7f5ff;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #339af0;
        }

        h2 {
            color: #212529;
            font-size: 1.5rem;
            font-weight: 500;
            margin-bottom: 1.5rem;
        }
    </style>
</head>
<body>
    <header class="header">
        <h1>智慧步數分析系統</h1>
        <div class="profile">
            <span class="user-name">使用者名稱</span>
            <div class="avatar">
                <img src="default-avatar.png" alt="使用者頭像">
            </div>
        </div>
    </header>

    <main class="container">
        <section class="data-panel">
            <h2>活動數據</h2>
            <div class="chart-container">
                <canvas id="stepsChart"></canvas>
            </div>
            <div class="stats-grid">
                <div class="stat-card">
                    <h3>今日步數</h3>
                    <div class="value" id="todaySteps">0</div>
                </div>
                <div class="stat-card">
                    <h3>目標達成率</h3>
                    <div class="value" id="goalProgress">0%</div>
                </div>
                <div class="stat-card">
                    <h3>消耗熱量</h3>
                    <div class="value" id="calories">0 kcal</div>
                </div>
                <div class="stat-card">
                    <h3>活動時間</h3>
                    <div class="value" id="activeTime">0 分鐘</div>
                </div>
            </div>
        </section>

        <section class="ai-analysis">
            <h2>AI 分析與建議</h2>
            <div class="analysis-card">
                <h3>今日活動分析</h3>
                <div id="activityAnalysis"></div>
            </div>
            <div class="analysis-card">
                <h3>個人化建議</h3>
                <div id="aiSuggestions"></div>
            </div>
            <div class="analysis-card">
                <h3>健康趨勢</h3>
                <div id="healthTrend"></div>
            </div>
        </section>
    </main>
    <script src="app.js"></script>
</body>
</html>
```

### 2. 數據視覺化
```javascript
// app.js
// 圖表初始化
function initChart() {
    const ctx = document.getElementById('stepsChart').getContext('2d');
    const chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [], // 時間標籤
            datasets: [{
                label: '步數記錄',
                data: [], // 步數數據
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
    return chart;
}

// 更新圖表數據
function updateChart(chart, newData) {
    chart.data.labels.push(new Date().toLocaleTimeString());
    chart.data.datasets[0].data.push(newData);
    // 保持最新的 10 筆數據
    if (chart.data.labels.length > 10) {
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
    }
    chart.update();
}
```

### 3. AI 分析實作
```javascript
// ai-analysis.js
class StepsAnalyzer {
    constructor() {
        this.dailyGoal = 8000; // 預設目標步數
        this.averageSteps = 0;
        this.history = [];
    }

    analyzeSteps(steps) {
        this.history.push(steps);
        this.averageSteps = this.calculateAverage();
        
        return {
            current: steps,
            average: this.averageSteps,
            recommendation: this.generateRecommendation(steps),
            trend: this.analyzeTrend()
        };
    }

    calculateAverage() {
        return this.history.reduce((a, b) => a + b, 0) / this.history.length;
    }

    generateRecommendation(steps) {
        if (steps < this.dailyGoal * 0.3) {
            return "活動量偏低，建議多走動，可以考慮午休時散步";
        } else if (steps < this.dailyGoal * 0.7) {
            return "活動量適中，繼續保持，建議傍晚再散步15分鐘";
        } else if (steps >= this.dailyGoal) {
            return "太棒了！已達成今日目標，記得適度休息";
        }
        return "距離目標還差一點，加油！";
    }

    analyzeTrend() {
        // 分析最近趨勢
        const recentSteps = this.history.slice(-3);
        const trend = recentSteps.reduce((a, b) => b - a);
        
        if (trend > 0) return "步數呈上升趨勢，表現不錯！";
        if (trend < 0) return "步數有下降趨勢，建議增加活動量";
        return "步數維持穩定";
    }
}
```

### 4. 數據接收與更新
```javascript
// websocket-client.js
const ws = new WebSocket('ws://localhost:3000');
const chart = initChart();
const analyzer = new StepsAnalyzer();

ws.onmessage = (event) => {
    const steps = JSON.parse(event.data).steps;
    
    // 更新圖表
    updateChart(chart, steps);
    
    // AI 分析
    const analysis = analyzer.analyzeSteps(steps);
    
    // 更新分析結果
    document.getElementById('aiAnalysis').innerHTML = `
        <p>目前步數：${analysis.current}</p>
        <p>平均步數：${analysis.average}</p>
        <p>建議：${analysis.recommendation}</p>
        <p>趨勢：${analysis.trend}</p>
    `;
};
```

### 5. Arduino 數據傳輸
```cpp
// arduino 程式更新
void sendStepsData(int steps) {
    String data = "{\"steps\":" + String(steps) + "}";
    Serial.println(data);  // 透過藍牙傳送
}
```

## 簡化版數據處理方案

### 1. 後端簡化版（使用 Express + JSON 文件存储）
```javascript
// server.js
const express = require('express');
const fs = require('fs');
const WebSocket = require('ws');
const SerialPort = require('serialport');
const app = express();
const wss = new WebSocket.Server({ port: 8080 });

// 數據存储路徑
const DATA_FILE = 'steps_data.json';

// 確保數據文件存在
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}

// 設置藍牙串口
const port = new SerialPort('/dev/tty.HC-05', {
    baudRate: 9600,
    parser: SerialPort.parsers.readline('\n')
});

// 讀取歷史數據
function readStepsData() {
    try {
        const data = fs.readFileSync(DATA_FILE);
        return JSON.parse(data);
    } catch (error) {
        console.error('讀取數據失敗:', error);
        return [];
    }
}

// 保存新數據
function saveStepData(stepData) {
    try {
        const data = readStepsData();
        data.push({
            ...stepData,
            timestamp: new Date().toISOString()
        });
        // 只保留最近 30 天的數據
        const recentData = data.slice(-30);
        fs.writeFileSync(DATA_FILE, JSON.stringify(recentData));
    } catch (error) {
        console.error('保存數據失敗:', error);
    }
}

// 監聽藍牙數據
port.on('data', (data) => {
    try {
        const stepData = JSON.parse(data);
        // 儲存數據
        saveStepData(stepData);
        // 廣播給所有連接的客戶端
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(stepData));
            }
        });
    } catch (e) {
        console.error('數據解析錯誤:', e);
    }
});

// API 路由
app.get('/api/steps', (req, res) => {
    const data = readStepsData();
    res.json(data);
});

app.listen(3000, () => {
    console.log('伺服器運行於 http://localhost:3000');
});
```

### 2. 前端本地存儲
```javascript
// app.js
class StepDataManager {
    constructor() {
        this.storageKey = 'stepTrackerData';
        this.dailyGoal = parseInt(localStorage.getItem('dailyGoal')) || 8000;
    }

    // 保存每日目標
    setDailyGoal(goal) {
        this.dailyGoal = goal;
        localStorage.setItem('dailyGoal', goal);
    }

    // 獲取今日數據
    getTodayData() {
        const data = this.getAllData();
        const today = new Date().toDateString();
        return data[today] || { steps: 0, goal: this.dailyGoal };
    }

    // 更新步數
    updateSteps(steps) {
        const data = this.getAllData();
        const today = new Date().toDateString();
        data[today] = {
            steps: steps,
            goal: this.dailyGoal,
            timestamp: new Date().toISOString()
        };
        localStorage.setItem(this.storageKey, JSON.stringify(data));
        this.updateUI(data[today]);
    }

    // 獲取所有數據
    getAllData() {
        const data = localStorage.getItem(this.storageKey);
        return data ? JSON.parse(data) : {};
    }

    // 更新界面
    updateUI(todayData) {
        document.getElementById('todaySteps').textContent = todayData.steps;
        const progress = Math.round((todayData.steps / todayData.goal) * 100);
        document.getElementById('goalProgress').textContent = `${progress}%`;
        
        // 更新其他UI元素
        const calories = Math.round(todayData.steps * 0.04);
        const activeMinutes = Math.round(todayData.steps / 100);
        
        document.getElementById('calories').textContent = `${calories} kcal`;
        document.getElementById('activeTime').textContent = `${activeMinutes} 分鐘`;
    }
}

// 初始化
const dataManager = new StepDataManager();
const ws = new WebSocket('ws://localhost:8080');

// 接收實時數據
ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    dataManager.updateSteps(data.steps);
    updateChart(data.steps);
};
```

### 3. 安裝必要套件
```bash
# 安裝基本套件
npm install express ws serialport

# 啟動服務
node server.js
```

### 優點：
1. 不需要安裝資料庫
2. 設置簡單
3. 維護容易
4. 適合小型應用

### 注意事項：
1. 定期備份 JSON 文件
2. 清理過期數據
3. 監控文件大小
4. 處理併發寫入

這個方案更適合快速開發和測試。要開始實作嗎？
