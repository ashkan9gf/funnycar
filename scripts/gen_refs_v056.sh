#!/bin/bash
# تولید ۱۰ مرجع خام خودرو با z-ai image → download/tripo/refs/{name}_raw.png
set -e
SRC=/home/z/my-project/download/tripo/refs
mkdir -p "$SRC"
gen() {
  local name="$1"; shift
  local prompt="$1"
  if [ -s "$SRC/${name}_raw.png" ]; then echo "skip $name"; return; fi
  echo "=== $name ==="
  z-ai image -p "$prompt" -o "$SRC/${name}_raw.png" -s 1024x1024 || echo "FAIL $name"
}
gen pride "Red Saipa Pride hatchback car, small boxy Iranian economy hatchback, glossy red paint, black plastic bumpers, three-quarter front view, plain white studio background, soft even lighting, product photo, no shadow, no text"
gen nissan "Blue Nissan Junior pickup truck, Iranian Zamyad flatbed pickup, light blue paint, classic cab and open truck bed, black bumpers, three-quarter front view, plain white studio background, soft even lighting, product photo, no shadow, no text"
gen peugeot405 "White Peugeot 405 sedan, classic 1990s four-door family sedan, glossy white paint, black window trim, three-quarter front view, plain white studio background, soft even lighting, product photo, no shadow, no text"
gen samand "Silver IKCO Samand sedan, Iranian national modern four-door sedan, metallic silver paint, three-quarter front view, plain white studio background, soft even lighting, product photo, no shadow, no text"
gen tiba "Turquoise Saipa Tiba hatchback, small compact Iranian city hatchback, cyan turquoise paint, three-quarter front view, plain white studio background, soft even lighting, product photo, no shadow, no text"
gen taxi "Yellow Iranian taxi sedan, classic Peugeot 405 taxi cab in bright yellow paint with small orange taxi roof sign, three-quarter front view, plain white studio background, soft even lighting, product photo, no shadow, no text"
gen police "Iranian police patrol sedan car, white body with green side stripe and police markings, no light bar on roof, three-quarter front view, plain white studio background, soft even lighting, product photo, no shadow, no text"
gen renault4 "Beige Renault 4 classic hatchback, vintage 1970s French economy car, sand beige paint, boxy tall shape, three-quarter front view, plain white studio background, soft even lighting, product photo, no shadow, no text"
gen vintage "Olive green vintage classic sedan car, 1960s retro automobile with round headlights and chrome bumpers, olive green paint, three-quarter front view, plain white studio background, soft even lighting, product photo, no shadow, no text"
gen challenger "Orange Iranian Dena Plus sedan, modern four-door sedan in bright orange paint, sporty look, three-quarter front view, plain white studio background, soft even lighting, product photo, no shadow, no text"
echo ALL_DONE
