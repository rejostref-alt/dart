# Dart Licznik (PWA, offline)

Aplikacja na telefon (Android, Chrome), która z kamery telefonu na statywie liczy punkty w darta (tarcza stalowa).
Po pierwszym otwarciu z internetu działa w pełni offline: można ją zainstalować na ekranie głównym.

## Gry
- **301 / 501 / 701**: legi i sety (first to N), double out, double in, podpowiedź zejścia, średnia z 3 rzutek.
- **Cricket**: pola 15–20 i bull.
- **Po kolei** (Around the Clock): 1–20, potem bull. Opcjonalnie podwójne i potrójne przeskakują o 2 lub 3 pola.
- **Shanghai**: 7, 10 albo 20 rund. Shanghai, czyli single, double i triple celu w jednej kolejce, wygrywa od razu.
- **High Score**: 5, 10 albo 20 rund.

## Jak używać
1. Ustaw telefon na statywie **z przodu tarczy, pod kątem ok. 30–45°**, 1–1,5 m od tarczy. Cała tarcza musi być w kadrze, a światło równe.
2. W aplikacji wybierz graczy i grę, a potem **Dalej: kamera**.
3. Kalibracja: dotknij 4 punkty na **zewnętrznej krawędzi pola podwójnego**, na środku pól 20, 6, 3 i 11. Sprawdź, czy zielona siatka pokrywa tarczę. Punkty można przeciągać palcem.
4. **Start gry** przy tarczy bez lotek.
5. Rzucaj. Każda rzutka jest wykrywana po zatrzymaniu się obrazu, a wynik pojawia się w polach rzutek.
6. Po 3 rzutkach wyjmij lotki. Aplikacja sama przejdzie do następnego gracza. Jest też przycisk „Następny gracz”.
7. Pomyłkę poprawisz, dotykając pola rzutki (ostatniej) albo przyciskiem „Cofnij”.

## Pliki
- `index.html`, `styles.css`, `app.js`: interfejs.
- `board.js`: geometria tarczy i liczenie pól.
- `vision.js`: kamera, kalibracja (homografia), wykrywanie rzutek metodą różnicy obrazów (kolor RGB).
- `games.js`: zasady gier.
- `sw.js`, `manifest.webmanifest`, `icon-*.png`: tryb offline i instalacja.
- `test-sim.html`: test wykrywania na sztucznej tarczy (`?plan=x,y,dx,dy;...`).

## Test na komputerze
`python -m http.server 8917` w tym folderze, potem http://127.0.0.1:8917/ (na localhost service worker jest wyłączony).

## Instalacja na telefonie
Kamera i tryb offline w przeglądarce wymagają adresu **https**, więc pliki trzeba raz wrzucić na hosting HTTPS, np. GitHub Pages.
Potem w Chrome na telefonie otwórz adres i wybierz **Dodaj do ekranu głównego**. Od tej chwili aplikacja działa bez internetu.

## Dwa telefony (druga kamera)
Przeglądarka nie pozwala łączyć dwóch telefonów przez Bluetooth. Parowanie działa więc przez **wspólne Wi‑Fi bez internetu**: jeden telefon włącza hotspot, drugi się z nim łączy. Telefony wymieniają się danymi połączenia przez **kody QR** (WebRTC, dane idą bezpośrednio między telefonami).
1. Główny telefon: **Paruj drugi telefon**. Pokaże się kod QR.
2. Drugi telefon: **Ten telefon to druga kamera**. Zeskanuj kod z głównego, a drugi telefon pokaże swój kod.
3. Główny telefon: **Skanuj kod z drugiego telefonu**.
4. Drugi telefon przechodzi do kalibracji, potem wysyła wykryte rzutki. Główny telefon łączy obie kamery: jeśli ta sama rzutka pojawi się w obu w ciągu 1,5 s, położenie jest uśredniane. Wyniki są widoczne też na drugim telefonie.

Wersja aplikacji jest w nagłówku („wersja 3”). Przy każdej aktualizacji trzeba podbić `VERSION` w `app.js` i `CACHE` w `sw.js`.

## Plan dalszy
- Statystyki graczy, historia meczów.
- Dodatkowe gry (Killer, Bob's 27).
