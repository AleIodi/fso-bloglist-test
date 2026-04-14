const { test, expect } = require('@playwright/test')
const { loginWith, newBlogWith } = require('./helper')

test.describe('Blog app', () => {
	test.beforeEach(async ({ page, request }) => {
		await request.post('/api/testing/reset')
		await request.post('/api/users', {
			data: {
				name: 'Matti Luukkainen',
				username: 'mluukkai',
				password: 'salainen'
			}
		})
		await request.post('/api/users', {
			data: {
				name: 'Super Super',
				username: 'super',
				password: 'super'
			}
		})
		await page.goto('/')
	})

	test('Login form is shown', async ({ page }) => {
		const locator = page.getByText('log in to application')
		await expect(locator).toBeVisible()
	})

	test.describe('Login', () => {
		test('succeeds with correct credentials', async ({ page }) => {
			await loginWith(page, 'mluukkai', 'salainen')

			await expect(page.getByText('Matti Luukkainen logged in')).toBeVisible()
		})

		test('fails with wrong credentials', async ({ page }) => {
			await loginWith(page, 'mluukkai', 'wrong')

			const errorDiv = page.locator('.error')
			await expect(errorDiv).toContainText('invalid username or password')
		})
	})

	test.describe('when logged in', () => {
		test.beforeEach(async ({ page }) => {
			await loginWith(page, 'mluukkai', 'salainen')
		})

		test('a new blog can be created', async ({ page }) => {
			await newBlogWith(page, 'test', 'creation', 'new blog')

			await expect(page.getByText('test creation view')).toBeVisible()
		})

		test('a blog can be liked', async ({ page }) => {
			await newBlogWith(page, 'test', 'creation', 'new blog')

			await page.getByRole('button', { name: 'view' }).click()
			await expect(page.getByText('likes 0')).toBeVisible()

			await page.getByRole('button', { name: 'like' }).click()
			await expect(page.getByText('likes 1')).toBeVisible()
		})

		test('the user who added the blog can delete it', async ({ page }) => {
			await newBlogWith(page, 'test', 'creation', 'new blog')

			await page.getByRole('button', { name: 'view' }).click()
			await expect(page.getByText('Matti Luukkainen', { exact: true })).toBeVisible()

			page.on('dialog', async dialog => {
				await dialog.accept()
			})

			await page.getByRole('button', { name: 'delete' }).click()
			await expect(page.getByText('test creation view')).not.toBeVisible()
		})

		test('only the user who created the blog can delete it', async ({ page }) => {
			await newBlogWith(page, 'test', 'creation', 'new blog')
			await page.getByRole('button', { name: 'view' }).click()
			await expect(page.getByRole('button', { name: 'delete' })).toBeVisible()

			await page.getByRole('button', { name: 'logout' }).click()

			await loginWith(page, 'super', 'super')
			await page.getByRole('button', { name: 'view' }).click()
			await expect(page.getByRole('button', { name: 'delete' })).not.toBeVisible()
		})

		test('blogs are arranged in the order according to the likes', async ({ page }) => {
			// Create blogs with completely unique names so filtering is exact
			await newBlogWith(page, 'Title A - least likes', 'Author A', 'http://test1.com')
			await newBlogWith(page, 'Title B - most likes', 'Author B', 'http://test2.com')
			await newBlogWith(page, 'Title C - second most', 'Author C', 'http://test3.com')

			// Find specific blogs using their unique titles
			const mostLikesBlog = page.locator('.blog').filter({ hasText: 'Title B - most likes' })
			const secondLikesBlog = page.locator('.blog').filter({ hasText: 'Title C - second most' })

			// Like "Title B" twice
			await mostLikesBlog.getByRole('button', { name: 'view' }).click()
			await mostLikesBlog.getByRole('button', { name: 'like' }).click()
			await expect(mostLikesBlog.getByText('likes 1')).toBeVisible() // Wait for update
			await mostLikesBlog.getByRole('button', { name: 'like' }).click()
			await expect(mostLikesBlog.getByText('likes 2')).toBeVisible() // Wait for update

			// Like "Title C" once
			await secondLikesBlog.getByRole('button', { name: 'view' }).click()
			await secondLikesBlog.getByRole('button', { name: 'like' }).click()
			await expect(secondLikesBlog.getByText('likes 1')).toBeVisible() // Wait for update

			// Check the final sorted order
			const blogList = page.locator('.blog')

			// Playwright's toContainText() will automatically wait/retry if the React app takes 
			// a fraction of a second to sort the list after the likes update.
			await expect(blogList.nth(0)).toContainText('Title B - most likes')
			await expect(blogList.nth(1)).toContainText('Title C - second most')
			await expect(blogList.nth(2)).toContainText('Title A - least likes')
		})
	})
})