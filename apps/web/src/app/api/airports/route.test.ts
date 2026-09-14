import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, normalizeSearchText } from './route';

describe('Airport search route', () => {
  it('normalizes diacritics', () => {
    expect(normalizeSearchText('São Paulo')).toBe('sao paulo');
    expect(normalizeSearchText('Brasília')).toBe('brasilia');
    expect(normalizeSearchText('Belém')).toBe('belem');
    expect(normalizeSearchText('Florianópolis')).toBe('florianopolis');
  });

  it('searches for Brazilian cities with or without accents', async () => {
    const reqWithAccent = new NextRequest('http://localhost:3003/api/airports?q=São%20Paulo');
    const resWithAccent = await GET(reqWithAccent);
    const jsonWithAccent = await resWithAccent.json();
    expect(jsonWithAccent.ok).toBe(true);
    expect(jsonWithAccent.data.some((a: { code: string }) => a.code === 'GRU' || a.code === 'CGH')).toBe(true);

    const reqWithoutAccent = new NextRequest('http://localhost:3003/api/airports?q=sao%20paulo');
    const resWithoutAccent = await GET(reqWithoutAccent);
    const jsonWithoutAccent = await resWithoutAccent.json();
    expect(jsonWithoutAccent.ok).toBe(true);
    expect(jsonWithoutAccent.data.some((a: { code: string }) => a.code === 'GRU' || a.code === 'CGH')).toBe(true);
  });

  it('matches exact IATA code', async () => {
    const req = new NextRequest('http://localhost:3003/api/airports?q=GRU');
    const res = await GET(req);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data[0].code).toBe('GRU');
    expect(json.data[0].country).toBe('BR');
  });

  it('rejects query shorter than 2 characters', async () => {
    const req = new NextRequest('http://localhost:3003/api/airports?q=G');
    const res = await GET(req);
    const json = await res.json();
    expect(json.ok).toBe(false);
  });
});
