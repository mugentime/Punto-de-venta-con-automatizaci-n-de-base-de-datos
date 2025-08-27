const { Octokit } = require('@octokit/rest');
const fs = require('fs').promises;
const path = require('path');

class GitPersistence {
    constructor() {
        // Use environment variable or hardcoded token
        this.token = process.env.GITHUB_TOKEN || 'ghp_YOUR_TOKEN_HERE';
        this.owner = 'mugentime';
        this.repo = 'POS-CONEJONEGRO';
        this.branch = 'data-persistence';
        
        this.octokit = new Octokit({
            auth: this.token
        });
    }

    async saveToGitHub(filename, data) {
        try {
            const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
            const filePath = `data/${filename}`;
            
            // Get current file SHA if exists
            let sha;
            try {
                const { data: fileData } = await this.octokit.repos.getContent({
                    owner: this.owner,
                    repo: this.repo,
                    path: filePath,
                    ref: this.branch
                });
                sha = fileData.sha;
            } catch (error) {
                // File doesn't exist, will create new
            }

            // Update or create file
            await this.octokit.repos.createOrUpdateFileContents({
                owner: this.owner,
                repo: this.repo,
                path: filePath,
                message: `Auto-save: ${filename} at ${new Date().toISOString()}`,
                content: content,
                branch: this.branch,
                sha: sha
            });

            console.log(`✅ Saved ${filename} to GitHub`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to save to GitHub:`, error.message);
            return false;
        }
    }

    async loadFromGitHub(filename) {
        try {
            const filePath = `data/${filename}`;
            
            const { data: fileData } = await this.octokit.repos.getContent({
                owner: this.owner,
                repo: this.repo,
                path: filePath,
                ref: this.branch
            });

            const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
            const data = JSON.parse(content);
            
            console.log(`✅ Loaded ${filename} from GitHub`);
            return data;
        } catch (error) {
            console.error(`❌ Failed to load from GitHub:`, error.message);
            return null;
        }
    }

    async syncData() {
        try {
            // Load all data files
            const dataPath = path.join(__dirname, '..', 'data');
            const files = ['records.json', 'products.json', 'users.json'];
            
            for (const file of files) {
                const localPath = path.join(dataPath, file);
                
                // Try to load from GitHub first
                const githubData = await this.loadFromGitHub(file);
                if (githubData) {
                    // Save GitHub data locally
                    await fs.writeFile(localPath, JSON.stringify(githubData, null, 2));
                } else {
                    // Load local and save to GitHub
                    try {
                        const localData = await fs.readFile(localPath, 'utf-8');
                        const data = JSON.parse(localData);
                        await this.saveToGitHub(file, data);
                    } catch (error) {
                        console.log(`No local file ${file} to sync`);
                    }
                }
            }
            
            console.log('✅ Data sync complete');
        } catch (error) {
            console.error('❌ Sync failed:', error);
        }
    }
}

module.exports = new GitPersistence();