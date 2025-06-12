#include <Wire.h>
#include <MPU6050.h>
#include <SoftwareSerial.h>

MPU6050 mpu;
SoftwareSerial BTSerial(2, 3); // TX, RX

int16_t ax, ay, az;
int steps = 0;
unsigned long lastStepTime = 0;

// 用來做簡易移動平均的陣列與指標
#define SMOOTH_SIZE 5
float zBuffer[SMOOTH_SIZE] = {0};
int bufferIndex = 0;

float lastZ = 0;
float highestZ = 0;
float lowestZ = 0;
bool cycleStarted = false;
bool peakDetected = false;

// 步伐判斷門檻
const float HEIGHT_THRESHOLD = 8000.0;   // 最小高度差檢測，用於過濾雜訊
const float MIN_VALID_HEIGHT = 15000.0;  // 最小有效步伐高度，低於此高度的步伐不計入（約15公分）
const float NOISE_THRESHOLD = 1000.0;    // 雜訊閾值，濾除小幅度擾動

// 間隔時間限制，避免重複計步(ms)
const unsigned long STEP_INTERVAL = 600;

float getAverageZ() {
  float sum = 0;
  for (int i = 0; i < SMOOTH_SIZE; i++) {
    sum += zBuffer[i];
  }
  return sum / SMOOTH_SIZE;
}

void setup() {
  Wire.begin();
  Serial.begin(9600);
  BTSerial.begin(9600);

  mpu.initialize();
  if (mpu.testConnection()) {
    Serial.println("MPU6050 已連線成功！");
    BTSerial.println("MPU6050 OK，準備開始計步！");
  } else {
    Serial.println("MPU6050 無法連線！");
    BTSerial.println("無法連線到 MPU6050！");
    while (1);
  }
}

void loop() {
  mpu.getAcceleration(&ax, &ay, &az);

  // 平滑處理 Z 軸數據
  zBuffer[bufferIndex] = az;
  bufferIndex = (bufferIndex + 1) % SMOOTH_SIZE;
  float avgZ = getAverageZ();

  unsigned long now = millis();

  // 判斷運動週期
  if (!cycleStarted) {
    // 檢測開始上升
    if (avgZ > (lastZ + NOISE_THRESHOLD)) {
      cycleStarted = true;
      peakDetected = false;
      highestZ = avgZ;
      lowestZ = avgZ;
    }
  } else {
    // 追蹤波峰
    if (!peakDetected) {
      if (avgZ > highestZ) {
        highestZ = avgZ;
      } else if (avgZ < (highestZ - NOISE_THRESHOLD)) {
        // 確認已經開始下降
        peakDetected = true;
        lowestZ = avgZ;
      }
    } 
    // 追蹤波谷
    else {
      if (avgZ < lowestZ) {
        lowestZ = avgZ;
      } 
      // 判斷是否完成完整週期（上升+下降）
      else if (avgZ > (lowestZ + NOISE_THRESHOLD)) {
        float totalHeight = highestZ - lowestZ;
        
        // 確認高度差超過最小檢測門檻
        if (totalHeight > HEIGHT_THRESHOLD && 
            (now - lastStepTime > STEP_INTERVAL)) {
          
          // 檢查是否達到最小有效高度
          if (totalHeight >= MIN_VALID_HEIGHT) {
            steps++;
            lastStepTime = now;

            // 發送 JSON 格式的步數數據（有效步伐）
            String jsonMessage = "{\"steps\":" + String(steps) + 
                               ",\"height\":" + String(totalHeight/1000.0, 2) +
                               ",\"valid\":true,\"cycle\":\"complete\"}";
            Serial.println(jsonMessage);
            BTSerial.println(jsonMessage);
            
            // 顯示目前累計的有效步數
            Serial.print("目前步數: ");
            Serial.print(steps);
            Serial.println(" 步");
            
            // 透過藍牙發送步數顯示訊息
            String stepDisplay = "..." + String(steps) + "步";
            BTSerial.println(stepDisplay);
          } else {
            // 發送未達到有效高度的資訊
            String jsonMessage = "{\"steps\":" + String(steps) + 
                               ",\"height\":" + String(totalHeight/1000.0, 2) +
                               ",\"valid\":false,\"cycle\":\"too_low\"}";
            Serial.println(jsonMessage);
            BTSerial.println(jsonMessage);
          }

          // 重置週期
          cycleStarted = false;
          
          // Debug 資訊
          Serial.print("週期高度: "); Serial.println(totalHeight);
        }
      }
    }
  }

  lastZ = avgZ;
  
  // 小延遲以避免讀取過快
  delay(50);
}

  delay(50);
}
