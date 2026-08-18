/*
 * DeckForge - Arduino Mega Button Controller
 * 
 * 4 botones en pines 2, 3, 4, 5 -> posiciones 0-3 del grid
 * 
 * Conexión: Botón entre pin y GND (INPUT_PULLUP, no necesita resistencia)
 * Protocolo: Serial 9600 baud, envía "BTN:X\n" al presionar
 */

const int BUTTON_PINS[] = {2, 3, 4, 5};
const int NUM_BUTTONS = 4;
const int LED_PIN = 13;
const unsigned long DEBOUNCE_MS = 50;

// Estado estable (tras debounce)
int buttonState[4];
// Última lectura raw
int lastReading[4];
// Timestamp de último cambio de lectura
unsigned long lastChangeTime[4];

void setup() {
  Serial.begin(9600);
  while (!Serial) {
    ; // Esperar a que el puerto serial esté disponible (necesario en algunos boards)
  }
  
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  
  for (int i = 0; i < NUM_BUTTONS; i++) {
    pinMode(BUTTON_PINS[i], INPUT_PULLUP);
    buttonState[i] = HIGH;
    lastReading[i] = HIGH;
    lastChangeTime[i] = 0;
  }
  
  delay(100);
  Serial.println("DECKFORGE:READY");
  Serial.flush();
}

void loop() {
  unsigned long now = millis();
  
  for (int i = 0; i < NUM_BUTTONS; i++) {
    int reading = digitalRead(BUTTON_PINS[i]);
    
    // Si la lectura cambió, resetear el timer de debounce
    if (reading != lastReading[i]) {
      lastChangeTime[i] = now;
      lastReading[i] = reading;
    }
    
    // Si la lectura es estable por más de DEBOUNCE_MS
    if ((now - lastChangeTime[i]) > DEBOUNCE_MS) {
      // Si el estado estable cambió
      if (reading != buttonState[i]) {
        buttonState[i] = reading;
        
        // Solo enviar en el flanco de bajada (presión)
        if (buttonState[i] == LOW) {
          Serial.print("BTN:");
          Serial.println(i);
          Serial.flush();
          
          // Flash LED
          digitalWrite(LED_PIN, HIGH);
          delay(30);
          digitalWrite(LED_PIN, LOW);
        }
      }
    }
  }
  
  delay(1);
}
