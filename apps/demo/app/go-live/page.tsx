import { GoLive } from '@/components/go-live';

export const metadata = {
    title: 'Go live · PMXT',
    description:
        'Three steps to ship a real prediction-market surface: create a PMXT account, grab an API key, enable builder mode and set a custom fee.',
};

export default function GoLivePage() {
    return <GoLive />;
}
