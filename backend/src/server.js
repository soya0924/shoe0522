const express = require('express');
const WebSocket = require('ws');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

// 創建 Express 應用
const app = express();
const wss = new WebSocket.Server({ port: 8080 });

// 中間件設置
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 數據文件設置
const DATA_FILE = path.join(__dirname, '../data/steps_data.json');
const dataDir = path.dirname(DATA_FILE);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}

// 藍牙設備狀態
let bluetoothStatus = {
    isConnected: false,
    lastError: null,
    reconnectAttempts: 0,
    maxReconnectAttempts: 5
};

// 藍牙設備管理
let port;
let parser;

// 列出所有可用的串口
async function listPorts() {
    try {
        const ports = await SerialPort.list();
        console.log('可用的串口設備：');
        ports.forEach(port => {
            console.log(`${port.path} - ${port.manufacturer || '未知製造商'}`);
        });
        return ports;
    } catch (error) {
        console.error('無法列出串口設備:', error);
        return [];
    }
}

// 連接藍牙設備
async function connectBluetooth() {
    if (bluetoothStatus.reconnectAttempts >= bluetoothStatus.maxReconnectAttempts) {
        console.log('已達到最大重連次數，請檢查設備後手動重啟伺服器');
        return null;
    }

    try {
        const ports = await listPorts();
        const btPort = ports.find(p => 
            p.path.includes('HC-05') || 
            p.path.includes('tty.Bluetooth') || 
            p.path.includes('COM')
        );

        if (!btPort) {
            throw new Error('未找到藍牙設備');
        }

        port = new SerialPort({
            path: btPort.path,
            baudRate: 9600,
            autoOpen: false
        });

        parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

        // 設置事件處理
        port.on('open', () => {
            console.log('藍牙連接成功！');
            bluetoothStatus.isConnected = true;
            bluetoothStatus.lastError = null;
            bluetoothStatus.reconnectAttempts = 0;
            
            // 通知所有 WebSocket 客戶端藍牙已連接
            broadcastBluetoothStatus();
        });

        port.on('error', (err) => {
            console.error('藍牙連接錯誤:', err.message);
            bluetoothStatus.lastError = err.message;
            bluetoothStatus.isConnected = false;
            broadcastBluetoothStatus();
        });

        port.on('close', () => {
            console.log('藍牙連接已關閉');
            bluetoothStatus.isConnected = false;
            bluetoothStatus.reconnectAttempts++;
            broadcastBluetoothStatus();
            
            // 延遲重連，時間隨重試次數增加
            const delay = Math.min(1000 * Math.pow(2, bluetoothStatus.reconnectAttempts), 30000);
            setTimeout(connectBluetooth, delay);
        });

        // 數據處理
        parser.on('data', (data) => {
            try {
                const stepData = JSON.parse(data);
                console.log('收到步數數據:', stepData);
                
                // 添加時間戳和驗證
                if (typeof stepData.steps === 'number') {
                    const enhancedData = {
                        ...stepData,
                        timestamp: new Date().toISOString(),
                        deviceId: btPort.path
                    };
                    
                    saveStepData(enhancedData);
                    broadcastStepData(enhancedData);
                }
            } catch (e) {
                console.error('數據解析錯誤:', e);
            }
        });

        // 開啟連接
        port.open((err) => {
            if (err) {
                console.error('無法開啟串口:', err.message);
                bluetoothStatus.lastError = err.message;
                broadcastBluetoothStatus();
                return;
            }
            console.log('串口已開啟，等待數據...');
        });

        return port;
    } catch (error) {
        console.error('藍牙連接失敗:', error);
        bluetoothStatus.lastError = error.message;
        bluetoothStatus.isConnected = false;
        broadcastBluetoothStatus();
        return null;
    }
}

// 廣播藍牙狀態給所有客戶端
function broadcastBluetoothStatus() {
    const status = {
        type: 'bluetooth_status',
        ...bluetoothStatus
    };
    
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(status));
        }
    });
}

// 廣播步數數據給所有客戶端
function broadcastStepData(data) {
    const message = {
        type: 'step_data',
        data: data
    };
    
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}

// 讀取步數數據
function readStepsData() {
    try {
        const data = fs.readFileSync(DATA_FILE);
        return JSON.parse(data);
    } catch (error) {
        console.error('讀取數據失敗:', error);
        return [];
    }
}

// 保存步數數據
function saveStepData(stepData) {
    try {
        const data = readStepsData();
        data.push(stepData);
        
        // 只保留最近 30 天的數據
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const recentData = data.filter(d => 
            new Date(d.timestamp) > thirtyDaysAgo
        );
        
        fs.writeFileSync(DATA_FILE, JSON.stringify(recentData, null, 2));
    } catch (error) {
        console.error('保存數據失敗:', error);
    }
}

// WebSocket 連接處理
wss.on('connection', (ws) => {
    console.log('新的 WebSocket 連接');
    
    // 發送當前藍牙狀態
    ws.send(JSON.stringify({
        type: 'bluetooth_status',
        ...bluetoothStatus
    }));
    
    // 發送現有數據
    const data = readStepsData();
    ws.send(JSON.stringify({
        type: 'initial_data',
        data: data
    }));
    
    ws.on('close', () => {
        console.log('WebSocket 連接關閉');
    });
});

// API 路由
app.get('/api/status', (req, res) => {
    res.json(bluetoothStatus);
});

app.get('/api/steps', (req, res) => {
    const data = readStepsData();
    res.json(data);
});

app.get('/api/steps/today', (req, res) => {
    const data = readStepsData();
    const today = new Date().toDateString();
    const todayData = data.filter(d => 
        new Date(d.timestamp).toDateString() === today
    );
    res.json(todayData);
});

// 啟動伺服器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`伺服器運行在 http://localhost:${PORT}`);
    // 初始化藍牙連接
    connectBluetooth();
});
