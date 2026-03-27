export const TR_CITY_DISTRICTS: Record<string, string[]> = {
  Istanbul: ['Kadikoy', 'Besiktas', 'Sisli', 'Uskudar', 'Beyoglu', 'Bakirkoy', 'Fatih'],
  Ankara: ['Cankaya', 'Kecioren', 'Yenimahalle', 'Etimesgut', 'Mamak', 'Sincan'],
  Izmir: ['Konak', 'Bornova', 'Karabaglar', 'Buca', 'Karsiyaka', 'Bayrakli'],
  Bursa: ['Osmangazi', 'Nilufer', 'Yildirim', 'Mudanya', 'Gursu'],
  Antalya: ['Muratpasa', 'Kepez', 'Konyaalti', 'Aksu', 'Dosemealti'],
  Adana: ['Seyhan', 'Cukurova', 'Yuregir', 'Saricam'],
  Kocaeli: ['Izmit', 'Gebze', 'Darica', 'Golcuk', 'Basiskele'],
  Mugla: ['Bodrum', 'Fethiye', 'Marmaris', 'Milas', 'Menteşe'],
  Balikesir: ['Ayvalik', 'Edremit', 'Bandirma', 'Altieylul', 'Karesi'],
  Tekirdag: ['Suleymanpasa', 'Corlu', 'Cerkezkoy', 'Malkara']
};

export const TR_CITIES = Object.keys(TR_CITY_DISTRICTS).sort((a, b) => a.localeCompare(b, 'tr'));
