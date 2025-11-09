export const getAPIUrlBasedOffEnviornment = (): string => {

    let url: string = import.meta.env.DEV ? `http://localhost:3001` : `https://fantasma.io/api`;

    return url;

}