// Artifact menolak karakter U+FFFD mentah; ganti dengan escape � (hanya muncul di dalam string pustaka).
import { readFileSync, writeFileSync } from 'node:fs'
const p = process.argv[2] || 'dist-demo/index.html'
const s = readFileSync(p, 'utf8')
writeFileSync(p, s.replaceAll('�', '\\uFFFD'))
