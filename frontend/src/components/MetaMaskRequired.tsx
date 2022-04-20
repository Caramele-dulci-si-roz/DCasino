import React from 'react';

interface Props {
    message: string;
}

const MetaMaskRequired: React.FC<Props> = (props: Props) => {
    return (
        <div>
            <p>
              MetaMask initialization failed with the following error: {props.message} <br/>
              Refresh the page after you have metamask initialized correctly.
            </p>
        </div>
    );
}

export default MetaMaskRequired;