/*
  parking_controller_with_gmt7.ino
  - Adds NTP (GMT+7) and pushes timestamps (ISO + epoch ms) to RTDB when updating state/counts.
  - Keep your original logic otherwise.
*/

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ESP32Servo.h>
#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include "time.h"

//---------------- WIFI + FIREBASE ----------------
#define WIFI_SSID     "ParkingSystem"
#define WIFI_PASSWORD "11111111"

#define FIREBASE_HOST "https://parking2611-ef0c0-default-rtdb.asia-southeast1.firebasedatabase.app"
#define FIREBASE_AUTH "jMKWm8S3UZF0fiIFWghQkFOEsBtXQxHQu8HHE0NO"

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

//----------------- OLED ------------------
#define OLED_SDA 21
#define OLED_SCL 22
#define OLED_ADDR 0x3C
Adafruit_SSD1306 display(128, 64, &Wire, -1);

//----------------- SERVO ------------------
#define SERVO_IN_PIN  18
#define SERVO_OUT_PIN 19
Servo servoIn;
Servo servoOut;

const int SERVO_CLOSED = 1000;
const int SERVO_OPEN   = 2000;

//----------------- SENSORS ----------------
#define FRONT_IN_PIN   33
#define BACK_IN_PIN    32
#define FRONT_OUT_PIN  27
#define BACK_OUT_PIN   4

#define BUTTON_IN_PIN  25
#define BUTTON_OUT_PIN 26

//---------------- SYSTEM -------------------
const int CAPACITY = 5;
int currentCars = -1;

bool doorInOpen = false;
bool doorOutOpen = false;

//----------------- FIREBASE PATH -----------------
#define FIREBASE_GATE_IN      "/gate_in_trigger"
#define FIREBASE_GATE_OUT     "/gate_out_trigger"
#define FIREBASE_MANUAL_IN    "/manual_gate_in"
#define FIREBASE_MANUAL_OUT   "/manual_gate_out"

//----------------- SENSOR helper ----------------
inline bool sensorFrontIn()  { return digitalRead(FRONT_IN_PIN) == LOW; }
inline bool sensorBackIn()   { return digitalRead(BACK_IN_PIN) == HIGH; }
inline bool sensorFrontOut() { return digitalRead(FRONT_OUT_PIN) == HIGH; }
inline bool sensorBackOut()  { return digitalRead(BACK_OUT_PIN) == HIGH; }

//----------------- DOOR ----------------
void openGate(Servo &servo, bool &stateVar) {
  if (!stateVar) {
    servo.writeMicroseconds(SERVO_OPEN);
    stateVar = true;
  }
}

void closeGate(Servo &servo, bool &stateVar) {
  if (stateVar) {
    servo.writeMicroseconds(SERVO_CLOSED);
    stateVar = false;
  }
}

// ---------------- NTP / Time helpers (GMT+7) ----------------
// configure NTP to use GMT+7 (offset seconds) so localtime is already in GMT+7
void ensureTimeSynced() {
  // set GMT+7 offset (seconds), no DST offset
  configTime(7 * 3600, 0, "pool.ntp.org", "time.google.com", "time.cloudflare.com");
}

// Return ISO string YYYY-MM-DDTHH:MM:SS+07:00 (local time already adjusted)
String getIsoTimestampGMT7() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo, 5000)) {
    // fallback to millis if NTP not ready
    unsigned long ms = millis();
    return String("boot+") + String(ms);
  }
  char buf[32];
  // format as 2025-11-30T08:02:50+07:00
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%S", &timeinfo);
  String s = String(buf) + "+07:00";
  return s;
}

// epoch milliseconds adjusted to GMT+7
unsigned long long getEpochMsGMT7() {
  time_t now;
  if (time(&now) == ((time_t)-1)) {
    // fallback to millis since boot
    return (unsigned long long)millis();
  }
  // now is epoch seconds UTC; add 7h
  unsigned long long epochMs = (unsigned long long)(now + 7 * 3600) * 1000ULL;
  // add fractional ms from millis() remainder (non-perfect but ok)
  // we won't add fractional to avoid drift; this is acceptable
  return epochMs;
}

//----------------- FIREBASE HELPERS ----------------
// Helper to set int path and also set corresponding updatedAt ISO string
void setCountWithTimestamp(const char* intPath, int value, const char* tsPath) {
  // set the int
  if (!Firebase.RTDB.setInt(&fbdo, intPath, value)) {
    Serial.printf("RTDB.setInt %s failed: %d %s\n", intPath, fbdo.httpCode(), fbdo.errorReason().c_str());
  }
  // set timestamp string
  String iso = getIsoTimestampGMT7();
  if (!Firebase.RTDB.setString(&fbdo, tsPath, iso.c_str())) {
    Serial.printf("RTDB.setString %s failed: %d %s\n", tsPath, fbdo.httpCode(), fbdo.errorReason().c_str());
  }
}

void setCountOnRtdb(const char* path, int value) {
  // As before, write value to /count/...; also add updated timestamp sibling
  if (!Firebase.RTDB.setInt(&fbdo, path, value)) {
    Serial.printf("RTDB.setInt %s failed: %d %s\n", path, fbdo.httpCode(), fbdo.errorReason().c_str());
  }
  // write timestamp to e.g. /count/cars_updatedAt
  String tsPath = String(path) + String("_updatedAt");
  String iso = getIsoTimestampGMT7();
  if (!Firebase.RTDB.setString(&fbdo, tsPath.c_str(), iso.c_str())) {
    Serial.printf("RTDB.setString %s failed: %d %s\n", tsPath.c_str(), fbdo.httpCode(), fbdo.errorReason().c_str());
  }
}

// Push general state and include timestamps
void pushAllStates() {
  FirebaseJson json;
  json.set("front_in", sensorFrontIn());
  json.set("back_in", sensorBackIn());
  json.set("front_out", sensorFrontOut());
  json.set("back_out", sensorBackOut());
  json.set("door_in", doorInOpen);
  json.set("door_out", doorOutOpen);
  json.set("button_in", digitalRead(BUTTON_IN_PIN)==LOW);
  json.set("button_out", digitalRead(BUTTON_OUT_PIN)==LOW);
  json.set("cars", currentCars >= 0 ? currentCars : 0);
  json.set("free", currentCars >= 0 ? CAPACITY - currentCars : CAPACITY);

  // add timestamps
  String iso = getIsoTimestampGMT7();
  unsigned long long ms = getEpochMsGMT7();
  json.set("updatedAt_iso", iso.c_str());
  json.set("updatedAt_ms", (long long)ms);

  if (!Firebase.RTDB.setJSONAsync(&fbdo, "/state", &json)) {
    Serial.printf("RTDB.setJSONAsync /state failed: %d %s\n", fbdo.httpCode(), fbdo.errorReason().c_str());
  }

  // keep /count paths in sync and include updatedAt
  setCountOnRtdb("/count/cars", currentCars >= 0 ? currentCars : 0);
  setCountOnRtdb("/count/free", currentCars >= 0 ? (CAPACITY - currentCars) : CAPACITY);
}

//---------------- OLED ----------------
void showDisplay() {
  display.clearDisplay();
  display.setTextSize(2);
  display.setTextColor(WHITE);
  display.setCursor(0,0);
  display.print("Cars:");
  display.println(currentCars >= 0 ? currentCars : 0);

  display.setTextSize(1);
  display.setCursor(0,40);
  display.print("IN:");
  display.print(sensorFrontIn());

  display.setCursor(60,40);
  display.print("OUT:");
  display.print(sensorFrontOut());

  display.display();
}

//---------------- SETUP ----------------
void setup() {
  Serial.begin(115200);

  pinMode(FRONT_IN_PIN, INPUT);
  pinMode(BACK_IN_PIN, INPUT);
  pinMode(FRONT_OUT_PIN, INPUT);
  pinMode(BACK_OUT_PIN, INPUT);
  pinMode(BUTTON_IN_PIN, INPUT_PULLUP);
  pinMode(BUTTON_OUT_PIN, INPUT_PULLUP);

  servoIn.attach(2);
  servoOut.attach(SERVO_OUT_PIN);
  closeGate(servoIn, doorInOpen);
  closeGate(servoOut, doorOutOpen);

  Wire.begin(OLED_SDA, OLED_SCL);
  display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR);

  // WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long wifiStart = millis();
  while (WiFi.status() != WL_CONNECTED) {
    delay(200);
    if (millis() - wifiStart > 10000) {
      Serial.println("Waiting WiFi...");
    }
  }
  Serial.println("WiFi OK");

  // NTP: configure time in GMT+7
  ensureTimeSynced();
  // optionally wait briefly for time sync
  struct tm timeinfo;
  if (getLocalTime(&timeinfo, 5000)) {
    Serial.println("NTP time synced (GMT+7).");
  } else {
    Serial.println("NTP sync failed/timeout; timestamps will fallback to millis()");
  }

  // Firebase
  config.database_url = FIREBASE_HOST;
  config.signer.tokens.legacy_token = FIREBASE_AUTH;
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  fbdo.setResponseSize(1024);
  fbdo.setBSSLBufferSize(4096, 1024);
  fbdo.keepAlive(5, 5, 1);

  // initial sync of counts from RTDB (try once)
  if (Firebase.RTDB.getInt(&fbdo, "/count/cars")) {
    currentCars = fbdo.intData();
    Serial.printf("Initial cars from RTDB: %d\n", currentCars);
  } else {
    currentCars = 0;
    Serial.println("Initial cars default to 0");
  }

  // initial push
  pushAllStates();

  // ensure triggers/manual flags start at zero (optional)
  Firebase.RTDB.setInt(&fbdo, FIREBASE_GATE_IN, 0);
  Firebase.RTDB.setInt(&fbdo, FIREBASE_GATE_OUT, 0);
  Firebase.RTDB.setInt(&fbdo, FIREBASE_MANUAL_IN, 0);
  Firebase.RTDB.setInt(&fbdo, FIREBASE_MANUAL_OUT, 0);
}

//---------------- LOOP ----------------
unsigned long lastLoop = 0;
const unsigned long LOOP_INTERVAL = 10; // 10ms

void loop() {
  if(millis() - lastLoop < LOOP_INTERVAL) return;
  lastLoop = millis();

  showDisplay();

  // read triggers
  int gateInStatus    = Firebase.RTDB.getInt(&fbdo, FIREBASE_GATE_IN) ? fbdo.intData() : 0;
  int gateOutStatus   = Firebase.RTDB.getInt(&fbdo, FIREBASE_GATE_OUT) ? fbdo.intData() : 0;
  int manualGateIn    = Firebase.RTDB.getInt(&fbdo, FIREBASE_MANUAL_IN) ? fbdo.intData() : 0;
  int manualGateOut   = Firebase.RTDB.getInt(&fbdo, FIREBASE_MANUAL_OUT) ? fbdo.intData() : 0;

  // ================= MANUAL CONTROL =================
  if(manualGateIn == 1 && !doorInOpen) openGate(servoIn, doorInOpen);
  if(manualGateIn == 0 && doorInOpen) closeGate(servoIn, doorInOpen);

  if(manualGateOut == 1 && !doorOutOpen) openGate(servoOut, doorOutOpen);
  if(manualGateOut == 0 && doorOutOpen) closeGate(servoOut, doorOutOpen);

  // ================= AUTO IN =================
  if (sensorFrontIn() && digitalRead(BUTTON_IN_PIN)==LOW && gateInStatus != 1) {
    Firebase.RTDB.setInt(&fbdo, FIREBASE_GATE_IN, 1);
    Serial.println("Trigger IN -> 1 (sensor)");
  }

  if (gateInStatus == 2 && currentCars < CAPACITY && !doorInOpen) {
    if(currentCars < 0){
      if(Firebase.RTDB.getInt(&fbdo, "/count/cars")) currentCars = fbdo.intData();
      else currentCars = 0;
    }
    openGate(servoIn, doorInOpen);
  }

  if(doorInOpen && sensorBackIn()){
    closeGate(servoIn, doorInOpen);
    currentCars++;
    // update counts on RTDB and push state (timestamps included)
    setCountOnRtdb("/count/cars", currentCars);
    setCountOnRtdb("/count/free", CAPACITY - currentCars);
    pushAllStates();
    Firebase.RTDB.setInt(&fbdo, FIREBASE_GATE_IN, 0);
    Serial.println("Gate IN đã mở & đóng, count updated");
  }

  // ================= AUTO OUT =================
  if (sensorFrontOut() && digitalRead(BUTTON_OUT_PIN)==LOW && gateOutStatus != 1) {
    Firebase.RTDB.setInt(&fbdo, FIREBASE_GATE_OUT, 1);
    Serial.println("Trigger OUT -> 1 (sensor)");
  }

  if (gateOutStatus == 2 && currentCars > 0 && !doorOutOpen) {
    if(currentCars < 0){
      if(Firebase.RTDB.getInt(&fbdo, "/count/cars")) currentCars = fbdo.intData();
      else currentCars = 0;
    }
    openGate(servoOut, doorOutOpen);
  }

  if(doorOutOpen && sensorBackOut()){
    closeGate(servoOut, doorOutOpen);
    currentCars--;
    setCountOnRtdb("/count/cars", currentCars);
    setCountOnRtdb("/count/free", CAPACITY - currentCars);
    pushAllStates();
    Firebase.RTDB.setInt(&fbdo, FIREBASE_GATE_OUT, 0);
    Serial.println("Gate OUT đã mở & đóng, count updated");
  }

  // push quick sensors / button / door when changed
  static bool lastStates[10] = {false};
  bool states[10] = {
    sensorFrontIn(), sensorBackIn(),
    sensorFrontOut(), sensorBackOut(),
    doorInOpen, doorOutOpen,
    digitalRead(BUTTON_IN_PIN)==LOW,
    digitalRead(BUTTON_OUT_PIN)==LOW,
    currentCars>=0, currentCars<CAPACITY
  };
  bool changed = false;
  for(int i=0;i<10;i++){
    if(states[i] != lastStates[i]){
      changed = true;
      break;
    }
  }
  if(changed) {
    pushAllStates();
  }
  memcpy(lastStates, states, sizeof(states));
}