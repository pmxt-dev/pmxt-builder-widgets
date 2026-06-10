import { Showcase } from '@/components/showcase';
import { Providers } from './providers';

export default function Home() {
    return (
        <Providers>
            <Showcase />
        </Providers>
    );
}
