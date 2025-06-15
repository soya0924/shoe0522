#include <Wire.h>
#include <MPU6050.h>

MPU6050 mpu;
int16_t ax, ay, az;
int steps = 0;
unsigned long lastStepTime = 0;  // 用於計算步數間隔的時間戳記變數

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
const float HEIGHT_THRESHOLD = 1000.0;   // 最小高度差檢測（約1公分）
const float MIN_VALID_HEIGHT = 3000.0;  // 最小有效步伐高度（約10公分）
const float NOISE_THRESHOLD = 500.0;     // 雜訊閾值，降低以提高靈敏度

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
  Serial.begin(115200);
  delay(1000);  // 等待序列埠穩定

  Serial.println("序列埠初始化完成");

  mpu.initialize();
  if (mpu.testConnection()) {
    Serial.println(F("MPU6050 初始化成功"));
  } else {
    Serial.println(F("MPU6050 連接失敗")); 
    while (1);
  }

  // 發送初始資料
  Serial.println("{\"type\":\"step_data\",\"steps\":0,\"timestamp\":0}");
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

            // 輸出JSON格式的步數數據
            String jsonMessage = "{\"type\":\"step_data\",\"steps\":" + String(steps) + 
                               ",\"height\":" + String(totalHeight/1000.0, 2) + 
                               ",\"timestamp\":" + String(millis()) + "}";
            Serial.println(jsonMessage);
          
          } else {
            // 步伐高度不足的提示
            Serial.print(F("步伐高度不足 ("));
            Serial.print(totalHeight/1000.0, 2);
            Serial.println(F("cm)"));
          }

          // 重置週期
          cycleStarted = false;
        }
      }
    }
  }

  lastZ = avgZ;

  // 每500ms發送一次當前步數和加速度資料，即使沒有新的步數也發送
  static unsigned long lastUpdateTime = 0;
  if (now - lastUpdateTime >= 500) {  // 每500ms更新一次
    String jsonMessage = "{\"type\":\"step_data\",\"steps\":" + String(steps) + 
                       ",\"accel\":" + String(avgZ) +
                       ",\"timestamp\":" + String(millis()) + "}";
    Serial.println(jsonMessage);
    lastUpdateTime = now;
  }
  
  // 小延遲以避免讀取過快
  delay(20);
}

