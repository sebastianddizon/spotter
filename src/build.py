import re
parts=[open('part1_head.html').read(), '<div id="root"></div>\n<script>\n']
for f in ['engine.js','app_api.js','app_core.js','app_onboard.js','app_views.js','app_food.js','app_extra.js','app_events.js']:
    js=open(f).read()
    assert '</script' not in js, f
    parts.append(js+'\n')
parts.append('</script>\n')
open('coach-app.html','w').write(''.join(parts))
