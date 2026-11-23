import { expect, test, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { station } from '../fixtures';

async function chooseOption(scope: Page | Locator, field: string, option: string) {
  const select = scope.getByRole('combobox', { name: field, exact: true });
  await select.click();
  await scope.getByRole('listbox', { name: field, exact: true })
    .getByRole('option', { name: option, exact: true }).click();
  await expect(select).toHaveAttribute('aria-expanded', 'false');
  await expect(select).toHaveText(option);
}

test('datos reales: búsqueda manual, selección independiente y cálculo', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Buscar ubicación' })).toBeEnabled({ timeout: 40_000 });
  await page.getByLabel('Municipio o código postal').fill('Madrid');
  await page.getByRole('button', { name: 'Buscar ubicación' }).click();
  await page.getByRole('button', { name: 'Madrid, MADRID', exact: true }).click();
  await chooseOption(page, 'Distancia máxima', '20 km');
  const nearby = page.getByRole('list', { name: 'Gasolineras cercanas' });
  await nearby.getByRole('button').first().click();
  await page.getByLabel('Buscar marca o rótulo').fill('Repsol');
  await chooseOption(page, 'Marca seleccionada', 'REPSOL');
  const branded = page.getByRole('list', { name: 'Gasolineras de la marca' });
  // Evita la misma estación, aunque la primera cercana también sea Repsol.
  await branded.getByRole('button').nth(1).click();
  await page.getByLabel('Cashback de la estación de marca').fill('30');
  await expect(page.locator('.conclusion')).toContainText('Ahorrarás');
  await expect(page.locator('.break-even')).toBeVisible();
  const value = await page.locator('.conclusion').innerText();
  await page.getByLabel('Litros a repostar', { exact: true }).fill('100');
  await expect(page.locator('.conclusion')).not.toHaveText(value);
  await expect(page.locator('.conclusion')).toContainText('100 litros');
  await page.reload();
  await expect(page.getByLabel('Litros a repostar', { exact: true })).toHaveValue('100');
  await expect(page.getByLabel('Cashback de la estación de marca')).toHaveValue('30');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('regresión determinista del ejemplo, unidades, misma estación y límites', async ({ page }) => {
  await page.route('**/api/stations', route => route.fulfill({ json: {
    stations: [station({ id: 'a', name: 'CERCANA TEST', brand: 'CERCANA TEST', price: 1.621 }), station({ id: 'b', name: 'REPSOL TEST', brand: 'REPSOL TEST', price: 1.835 })],
    publishedAt: new Date().toISOString(), fetchedAt: new Date().toISOString(), stale: false, skipped: 0, source: 'test',
  } }));
  await page.goto('/');
  await page.getByLabel('Municipio o código postal').fill('28001');
  await page.getByRole('button', { name: 'Buscar ubicación' }).click();
  await page.getByRole('button', { name: '28001 · Madrid, MADRID' }).click();
  await page.getByRole('list', { name: 'Gasolineras cercanas' }).getByRole('button').first().click();
  await chooseOption(page, 'Marca seleccionada', 'REPSOL TEST');
  await page.getByRole('list', { name: 'Gasolineras de la marca' }).getByRole('button').click();
  await page.getByLabel('Cashback de la estación de marca').fill('30');
  await expect(page.locator('.conclusion')).toContainText('4,30');
  await expect(page.getByRole('article', { name: 'Coste de la gasolinera de marca' })).toContainText('76,75');
  await expect(page.locator('.break-even')).toContainText('0,214');
  await expect(page.locator('.break-even')).toContainText('1,921 €/L para el precio original del gasóleo en REPSOL TEST');
  await expect(page.locator('.break-even')).toContainText('Por debajo de ese precio de surtidor, gana la estación de marca');
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(accessibility.violations).toEqual([]);
  await chooseOption(page, 'Unidad del cashback', '€/L');
  await expect(page.getByLabel('Cashback de la estación de marca')).toHaveValue('0.3');
  await expect(page.locator('.conclusion')).toContainText('4,30');
  await expect(page.locator('.break-even')).toContainText('1,921 €/L para el precio original');
  await page.getByLabel('Cashback de la estación de marca').fill('0.2');
  await expect(page.locator('.break-even')).toContainText('1,821 €/L para el precio original');
  await page.getByLabel('Cashback de la estación de marca').fill('2');
  await expect(page.getByRole('alert')).toContainText('supera');
  await expect(page.locator('.winner')).toHaveCount(0);
  await page.getByLabel('Cashback de la estación de marca').fill('0');
  await page.getByRole('list', { name: 'Gasolineras cercanas' }).getByRole('button').nth(1).click();
  await expect(page.getByRole('alert')).toContainText('misma estación');
});

test('filtros independientes y orden del listado de marca', async ({ page }) => {
  const stations = [
    station({ id: 'a', name: 'GALP MADRID', brand: 'GALP', price: 1.6 }),
    station({ id: 'b', name: 'REPSOL MADRID', price: 1.8, lat: 40.42, postalCode: '28002' }),
    station({ id: 'c', name: 'REPSOL LEGANÉS', price: 1.5, lat: 40.39, postalCode: '28911', municipality: 'Leganés' }),
  ];
  await page.route('**/api/stations', route => route.fulfill({ json: {
    stations, publishedAt: new Date().toISOString(), fetchedAt: new Date().toISOString(), stale: false, skipped: 0, source: 'test',
  } }));
  await page.goto('/');
  await page.getByLabel('Municipio o código postal').fill('28001');
  await page.getByRole('button', { name: 'Buscar ubicación' }).click();
  await page.getByRole('button', { name: '28001 · Madrid, MADRID' }).click();

  const nearby = page.getByRole('region', { name: 'A Cerca de ti' });
  const branded = page.getByRole('region', { name: 'B Tu marca, con ventaja' });
  const nearbyRows = nearby.getByRole('list', { name: 'Gasolineras cercanas' }).getByRole('button');
  const brandedRows = branded.getByRole('list', { name: 'Gasolineras de la marca' }).getByRole('button');

  await chooseOption(branded, 'Marca seleccionada', 'REPSOL');
  await expect(brandedRows.first()).toContainText('REPSOL MADRID');
  await chooseOption(nearby, 'Marca', 'GALP');
  await expect(nearbyRows).toHaveCount(1);
  await expect(nearbyRows.first()).toContainText('GALP MADRID');
  await nearbyRows.first().click();
  await chooseOption(nearby, 'Población', 'Leganés, MADRID');
  await expect(nearby.getByText('No hay estaciones en este radio con los filtros elegidos.', { exact: false })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Coste de la gasolinera cercana' })).toContainText('GALP MADRID');
  await expect(brandedRows).toHaveCount(2);
  await chooseOption(nearby, 'Marca', 'Todas');
  await expect(nearbyRows.first()).toContainText('REPSOL LEGANÉS');
  await chooseOption(branded, 'Población', 'Madrid, MADRID');
  await expect(brandedRows).toHaveCount(1);
  await expect(brandedRows.first()).toContainText('REPSOL MADRID');
  await expect(nearbyRows.first()).toContainText('REPSOL LEGANÉS');
  await chooseOption(branded, 'Población', 'Todas');
  await chooseOption(branded, 'Ordenar por', 'Menor precio');
  await expect(brandedRows.first()).toContainText('REPSOL LEGANÉS');
  await chooseOption(branded, 'Ordenar por', 'Más cercanas');
  await expect(brandedRows.first()).toContainText('REPSOL MADRID');
});

test('errores de API y geolocalización sin datos ficticios', async ({ page }) => {
  await page.route('**/api/stations', route => route.fulfill({ status: 502, json: { error: 'Servicio oficial no disponible.' } }));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition: (_ok: unknown, fail: (e: { code: number }) => void) => fail({ code: 1 }) } });
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Servicio oficial no disponible');
  await page.getByRole('button', { name: 'Usar mi ubicación' }).click();
  await expect(page.getByText('Permiso de ubicación denegado.', { exact: false })).toBeVisible();
  await expect(page.locator('.station-price')).toHaveCount(0);
});

test('accesibilidad automática WCAG 2.2 AA y navegación por teclado', async ({ page }) => {
  await page.route('**/api/stations', route => route.fulfill({ json: { stations: [station()], publishedAt: new Date().toISOString(), fetchedAt: new Date().toISOString(), stale: false, skipped: 0, source: 'test' } }));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Buscar ubicación' })).toBeEnabled();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused();
  const radius = page.getByRole('combobox', { name: 'Distancia máxima' });
  await radius.focus();
  await radius.press('ArrowDown');
  await expect(radius).toHaveAttribute('aria-expanded', 'true');
  await radius.press('End');
  const lastRadius = page.getByRole('option', { name: '50 km' });
  const activeId = await lastRadius.getAttribute('id');
  expect(activeId).toBeTruthy();
  await expect(radius).toHaveAttribute('aria-activedescendant', activeId!);
  await radius.press('Enter');
  await expect(radius).toHaveText('50 km');
  await expect(radius).toHaveAttribute('aria-expanded', 'false');
  await expect(radius).toBeFocused();
  await radius.press('Space');
  await radius.press('Escape');
  await expect(radius).toHaveAttribute('aria-expanded', 'false');
  await expect(radius).toBeFocused();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
