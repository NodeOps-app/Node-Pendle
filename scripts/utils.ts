import fs from 'fs';
import path from 'path';

const DEPLOYMENT_FILE = path.join(__dirname, 'deployments.json');

export async function saveDeployment(name: string, address: string) {
    let deployments = {};
    if (fs.existsSync(DEPLOYMENT_FILE)) {
        deployments = JSON.parse(fs.readFileSync(DEPLOYMENT_FILE, 'utf8'));
    }
    deployments[name] = address;
    fs.writeFileSync(DEPLOYMENT_FILE, JSON.stringify(deployments, null, 2));
}

export async function getDeploymentAddress(name: string): Promise<string> {
    if (!fs.existsSync(DEPLOYMENT_FILE)) {
        throw new Error(`No deployments found`);
    }
    const deployments = JSON.parse(fs.readFileSync(DEPLOYMENT_FILE, 'utf8'));
    const address = deployments[name];
    if (!address) {
        throw new Error(`No deployment found for ${name}`);
    }
    return address;
}
