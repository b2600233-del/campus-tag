-- =========================================================
-- Campus Tag
-- Initial language master data
-- =========================================================

insert into public.languages (
  code,
  name_en,
  name_ja,
  is_active
)
values
  ('ja', 'Japanese', '日本語', true),
  ('en', 'English', '英語', true),
  ('zh', 'Chinese', '中国語', true),
  ('ko', 'Korean', '韓国語', true),
  ('ar', 'Arabic', 'アラビア語', true),
  ('fr', 'French', 'フランス語', true),
  ('de', 'German', 'ドイツ語', true),
  ('es', 'Spanish', 'スペイン語', true),
  ('ru', 'Russian', 'ロシア語', true),
  ('mn', 'Mongolian', 'モンゴル語', true),
  ('pt', 'Portuguese', 'ポルトガル語', true),
  ('it', 'Italian', 'イタリア語', true),
  ('th', 'Thai', 'タイ語', true),
  ('vi', 'Vietnamese', 'ベトナム語', true),
  ('id', 'Indonesian', 'インドネシア語', true),
  ('ms', 'Malay', 'マレー語', true),
  (
    'tl',
    'Filipino / Tagalog',
    'フィリピノ語・タガログ語',
    true
  ),
  ('hi', 'Hindi', 'ヒンディー語', true),
  ('bn', 'Bengali', 'ベンガル語', true),
  ('ne', 'Nepali', 'ネパール語', true),
  ('fa', 'Persian', 'ペルシア語', true),
  ('tr', 'Turkish', 'トルコ語', true),
  ('uk', 'Ukrainian', 'ウクライナ語', true),
  ('my', 'Burmese', 'ビルマ語', true)
on conflict (code)
do update set
  name_en = excluded.name_en,
  name_ja = excluded.name_ja,
  is_active = excluded.is_active;