import { expect, type Locator } from '@playwright/test';

export async function chooseObserverLocation(
  container: Locator,
  pickerAriaLabel: string,
  query: string,
  optionName: string | RegExp,
): Promise<void> {
  await openObserverLocationPicker(container, pickerAriaLabel);
  await container.locator('app-earth-observer-location-picker input[type="search"]').fill(query);
  await container.getByRole('option', { name: optionName }).click();
}

export async function chooseCustomObserverLocation(
  container: Locator,
  pickerAriaLabel: string,
  customLabel: string,
): Promise<void> {
  await openObserverLocationPicker(container, pickerAriaLabel);
  await container.getByRole('button', { name: customLabel, exact: true }).click();
}

async function openObserverLocationPicker(
  container: Locator,
  pickerAriaLabel: string,
): Promise<void> {
  const summary = container.locator('app-earth-observer-location-picker summary');

  await expect(summary).toHaveAttribute('aria-label', pickerAriaLabel);
  await summary.click();
}
