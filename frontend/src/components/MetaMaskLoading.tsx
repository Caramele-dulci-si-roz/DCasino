import React from 'react';

interface Props {
    message: string;
}

const MetaMaskRequired: React.FC<Props> = (props: Props) => {
    return (
        <div>
            <p>
              MetaMask is waiting: {props.message}
            </p>
        </div>
    );
}

export default MetaMaskRequired;