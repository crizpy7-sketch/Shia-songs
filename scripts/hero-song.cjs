const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const START_SECONDS = 48;
const DURATION_SECONDS = 15;
const source = path.join(root, 'assets/media/que-suerte-la-mia.mp3');
const soundtrack = path.join(root, 'artifacts/film-render/que-suerte-hero.m4a');

function run(args) {
  const result = spawnSync('ffmpeg', ['-nostdin','-y','-hide_banner','-loglevel','error',...args], {encoding:'utf8'});
  if (result.error || result.status !== 0) throw result.error || new Error(result.stderr || 'FFmpeg failed');
}

function prepareHeroSong() {
  if (!fs.existsSync(source)) throw new Error('The selected Qué suerte la mía recording is missing.');
  fs.mkdirSync(path.dirname(soundtrack), {recursive:true});
  run(['-ss',String(START_SECONDS),'-i',source,'-t',String(DURATION_SECONDS),'-map','0:a:0','-map_metadata','-1',
    '-af','afade=t=in:st=0:d=0.12,afade=t=out:st=14.45:d=0.55','-c:a','aac','-b:a','192k','-movflags','+faststart',soundtrack]);
  return soundtrack;
}

function remixExistingFilms() {
  const audio = prepareHeroSong();
  const report = [];
  for (const locale of ['en','es']) {
    const output = path.join(root, `assets/media/shia-story-song-${locale}.mp4`);
    const original = path.join(root, `assets/media/shia-story-${locale}.mp4`);
    const input = fs.existsSync(original) ? original : output;
    if (!fs.existsSync(input)) throw new Error(`Render the ${locale} visual film first.`);
    const temporary = path.join(root, `artifacts/film-render/song-remix-${locale}.mp4`);
    fs.mkdirSync(path.dirname(temporary), {recursive:true});
    run(['-i',input,'-i',audio,'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','copy','-map_metadata','-1',
      '-t',String(DURATION_SECONDS),'-movflags','+faststart',temporary]);
    fs.renameSync(temporary, output);
    report.push({locale,output:path.relative(root,output),songStart:START_SECONDS,duration:DURATION_SECONDS});
  }
  console.log(JSON.stringify(report));
}

module.exports = { prepareHeroSong, START_SECONDS, DURATION_SECONDS };
if (require.main === module) remixExistingFilms();
